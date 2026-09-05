import http from "node:http";
import {
  applySyncedCatalog,
  claimDueOutboxEntries,
  getAppSetting,
  getDeviceStationId,
  getSyncClientConfig,
  getSyncStatus,
  getUtcNow,
  isBarberProvisioned,
  logSystemEvent,
  markOutboxFailed,
  markOutboxSent,
  setSyncStatusField,
  type SyncStatus,
} from "../database";

const DEFAULT_SYNC_INTERVAL_MS = 15_000;
const REQUEST_TIMEOUT_MS = 15_000;
const RETRY_BASE_SECONDS = 20;
const RETRY_CAP_SECONDS = 300;
const MAX_AUTO_ATTEMPTS = 12;
const POST_INGEST_PATH = "/api/v1/sales/ingest";

interface SyncCatalogPayload {
  services: Array<{
    id: number;
    name: string;
    description: string | null;
    price: number;
    isDeleted: boolean;
    updatedAt: string;
  }>;
  barbers: Array<{
    id: number;
    username: string;
    pinHash: string | null;
    isActive: boolean;
    updatedAt: string;
  }>;
}

let timer: NodeJS.Timeout | null = null;
let inFlightCycle: Promise<void> | null = null;

interface JsonResponse {
  status: number;
  body: Record<string, unknown>;
}

function httpJsonRequest(
  host: string,
  port: number,
  path: string,
  token: string,
  body?: unknown,
): Promise<JsonResponse> {
  return new Promise<JsonResponse>((resolve, reject) => {
    const payload = body === undefined ? null : JSON.stringify(body);
    const req = http.request(
      {
        host,
        port,
        path,
        method: payload === null ? "GET" : "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          ...(payload === null ? {} : { "Content-Type": "application/json" }),
        },
        timeout: REQUEST_TIMEOUT_MS,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          let parsed: Record<string, unknown>;
          try {
            parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          } catch {
            parsed = {};
          }
          resolve({ status: res.statusCode ?? 500, body: parsed });
        });
      },
    );
    req.on("timeout", () => {
      req.destroy(new Error("request timed out"));
    });
    req.on("error", (error) => {
      reject(error);
    });
    if (payload !== null) req.write(payload);
    req.end();
  });
}

function applyStatus(state: "online" | "offline", error: string | null): void {
  setSyncStatusField("state", state);
  if (error === null) {
    setSyncStatusField("last_error_at", null);
    setSyncStatusField("last_error", null);
  } else {
    const now = getUtcNow();
    setSyncStatusField("last_error_at", now);
    setSyncStatusField("last_error", error);
  }
}

async function fetchCatalog(config: {
  ownerHost: string;
  ownerPort: number;
  token: string;
}): Promise<JsonResponse> {
  return httpJsonRequest(config.ownerHost, config.ownerPort, "/api/v1/sync/catalog", config.token);
}

async function pushOutbox(
  config: { ownerHost: string; ownerPort: number; token: string },
  manual: boolean,
): Promise<number> {
  const now = getUtcNow();
  const entries = claimDueOutboxEntries(now, manual);
  let firstError: string | null = null;
  for (const entry of entries) {
    try {
      const res = await httpJsonRequest(
        config.ownerHost,
        config.ownerPort,
        POST_INGEST_PATH,
        config.token,
        { payload: entry.payload },
      );
      if (res.status === 200 && res.body.success === true) {
        markOutboxSent(entry.id, getUtcNow());
        logSystemEvent(
          "outbox_sent",
          `Outbox ${entry.id} acknowledged by owner`,
          getDeviceStationId(),
        );
        continue;
      }
      const error = `owner rejected (http ${res.status}): ${String(res.body.error ?? "unknown error")}`;
      if (res.status >= 400 && res.status < 500) {
        markOutboxFailed(entry.id, entry.attempts + 1, error, null);
        logSystemEvent(
          "outbox_permanent_failure",
          `Outbox ${entry.id} rejected permanently: ${error}`,
          getDeviceStationId(),
        );
      } else {
        markOutboxFailed(entry.id, entry.attempts + 1, error, nextRetryAt(entry.attempts + 1));
        logSystemEvent(
          "outbox_transient_failure",
          `Outbox ${entry.id} delivery failed: ${error}`,
          getDeviceStationId(),
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      markOutboxFailed(
        entry.id,
        entry.attempts + 1,
        `delivery error: ${message}`,
        nextRetryAt(entry.attempts + 1),
      );
      if (firstError === null) firstError = message;
      logSystemEvent(
        "outbox_transient_failure",
        `Outbox ${entry.id} delivery error: ${message}`,
        getDeviceStationId(),
      );
    }
  }
  if (firstError !== null) {
    applyStatus("offline", firstError);
  }
  return entries.length;
}

function nextRetryAt(attempts: number): string | null {
  if (attempts > MAX_AUTO_ATTEMPTS) return null;
  const delay = Math.min(
    RETRY_CAP_SECONDS,
    Math.max(1, RETRY_BASE_SECONDS * Math.pow(2, attempts - 1)),
  );
  return new Date(Date.now() + delay * 1000).toISOString();
}

function runSyncCycle(manual: boolean): Promise<void> {
  if (inFlightCycle) return inFlightCycle;
  inFlightCycle = runCycleBody(manual).finally(() => {
    inFlightCycle = null;
  });
  return inFlightCycle;
}

async function syncCatalog(config: {
  ownerHost: string;
  ownerPort: number;
  token: string;
}): Promise<boolean> {
  let catalogRes: JsonResponse;
  try {
    catalogRes = await fetchCatalog(config);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    applyStatus("offline", `catalog unreachable: ${message}`);
    logSystemEvent(
      "sync_catalog_transient_failure",
      `Catalog unreachable: ${message}`,
      getDeviceStationId(),
    );
    return false;
  }
  if (catalogRes.status !== 200) {
    const error = `catalog rejected (http ${catalogRes.status}): ${String(catalogRes.body.error ?? "unknown error")}`;
    const permanent = catalogRes.status >= 400 && catalogRes.status < 500;
    applyStatus("offline", error);
    logSystemEvent(
      permanent ? "sync_catalog_permanent_failure" : "sync_catalog_transient_failure",
      error,
      getDeviceStationId(),
    );
    return false;
  }
  if (
    catalogRes.body.success !== true ||
    !Array.isArray(catalogRes.body.services) ||
    !Array.isArray(catalogRes.body.barbers)
  ) {
    const error = "catalog payload is malformed";
    applyStatus("offline", error);
    logSystemEvent("sync_catalog_malformed", error, getDeviceStationId());
    return false;
  }
  const catalog = catalogRes.body as unknown as SyncCatalogPayload;
  applySyncedCatalog(catalog.services, catalog.barbers);
  applyStatus("online", null);
  logSystemEvent(
    "sync_catalog_applied_via_client",
    "Catalog fetched from owner",
    getDeviceStationId(),
  );
  return true;
}

async function runCycleBody(manual: boolean): Promise<void> {
  const config = getSyncClientConfig();
  if (!config) return;
  setSyncStatusField("syncing", "1");
  try {
    const catalogOk = await syncCatalog(config);
    await pushOutbox(config, manual);
    if (catalogOk) {
      setSyncStatusField("last_success_at", getUtcNow());
    }
  } finally {
    setSyncStatusField("syncing", "0");
  }
}

function startInterval(): void {
  if (timer) return;
  const raw = getAppSetting("sync.interval_ms");
  const parsed = raw === null ? NaN : Number.parseInt(raw, 10);
  const intervalMs = Number.isInteger(parsed) && parsed >= 2000 ? parsed : DEFAULT_SYNC_INTERVAL_MS;
  timer = setInterval(() => {
    void runSyncCycle(false).catch(() => {
      // Transient failures already recorded; the loop simply continues.
    });
  }, intervalMs);
}

export function startSyncClient(): void {
  if (!isBarberProvisioned()) return;
  startInterval();
  void runSyncCycle(false).catch(() => {
    // First cycle may fail while the owner is unreachable; keep the loop alive.
  });
}

export function stopSyncClient(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

export function triggerSyncNow(): Promise<SyncStatus> {
  return runSyncCycle(true)
    .catch(() => undefined)
    .then(() => getSyncStatus());
}

export function isSyncClientRunning(): boolean {
  return timer !== null;
}

export async function callOwnerProvision(
  host: string,
  port: number,
  token: string,
): Promise<JsonResponse> {
  return httpJsonRequest(host, port, "/api/v1/sync/provision", token);
}
