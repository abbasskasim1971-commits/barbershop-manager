import http from "node:http";
import { createHash, timingSafeEqual } from "node:crypto";
import {
  getDeviceStationId,
  getOwnerStationId,
  runOne,
  runQuery,
  runSql,
  beginTransaction,
  commitTransaction,
  rollbackTransaction,
  listTokenStations,
  logSystemEvent,
  getUtcNow,
} from "./database";
import type { BindParams } from "sql.js";

const DEFAULT_INGEST_PORT = 47812;
const MAX_BODY_BYTES = 512 * 1024;
const CLOCK_SKEW_MS = 48 * 60 * 60 * 1000;
const SALE_UUID_RE = /^sale_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INGEST_PATH = "/api/v1/sales/ingest";
const PROVISION_PATH = "/api/v1/sync/provision";
const CATALOG_PATH = "/api/v1/sync/catalog";

let server: http.Server | null = null;
let started = false;

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

// Constant-time comparison of two sha256 hex hashes (32 bytes each).
function tokenHashMatches(candidateHash: string, storedHash: string): boolean {
  const candidate = Buffer.from(candidateHash, "hex");
  const stored = Buffer.from(storedHash, "hex");
  if (candidate.length !== stored.length) return false;
  return timingSafeEqual(candidate, stored);
}

// Resolve the authenticated station from a bearer token. Only the candidate's
// sha256 hash is ever compared; the raw token never reaches the database or
// logs, and comparison is constant-time over the full hashes.
function authenticateStation(
  token: string,
): { id: number; role: "owner" | "barber"; isActive: boolean } | undefined {
  const candidateHash = hashToken(token);
  for (const station of listTokenStations()) {
    if (tokenHashMatches(candidateHash, station.tokenHash)) {
      return { id: station.id, role: station.role, isActive: station.isActive };
    }
  }
  return undefined;
}

function isDeviceOwnerStation(): boolean {
  return getDeviceStationId() === getOwnerStationId();
}

function readBody(req: http.IncomingMessage): Promise<{ buffer: Buffer; tooLarge: boolean }> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let tooLarge = false;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        tooLarge = true;
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve({ buffer: Buffer.concat(chunks), tooLarge }));
    req.on("error", reject);
  });
}

function bearerToken(req: http.IncomingMessage): string {
  const header = req.headers.authorization || "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1].trim() : "";
}

function sendJson(res: http.ServerResponse, status: number, body: Record<string, unknown>): void {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}

interface IngestLine {
  type: unknown;
  itemId: unknown;
  name: unknown;
  price: unknown;
  quantity: unknown;
  lineTotal: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nearEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < 1e-9;
}

// Validates an incoming sale payload entirely server-side. Returns a human
// readable reason for rejection, or null when the payload is acceptable.
function validateIngestPayload(
  payload: Record<string, unknown>,
  stationId: number,
): {
  reason: string | null;
  lineItems: IngestLine[];
  saleUuid: string;
  barberId: number;
  saleTimestamp: string;
  totalAmount: number;
} {
  const reason = (m: string) => ({
    reason: m,
    lineItems: [] as IngestLine[],
    saleUuid: "",
    barberId: 0,
    saleTimestamp: "",
    totalAmount: 0,
  });

  if (payload.schema_version !== 1) return reason("invalid schema version");
  if (typeof payload.sale_uuid !== "string" || !SALE_UUID_RE.test(payload.sale_uuid)) {
    return reason("invalid sale_uuid");
  }
  if (payload.source_station_id !== stationId) {
    return reason("source station does not match authenticated station");
  }
  if (!Number.isInteger(payload.barber_id) || (payload.barber_id as number) <= 0) {
    return reason("invalid barber id");
  }
  if (
    typeof payload.sale_timestamp !== "string" ||
    Number.isNaN(Date.parse(payload.sale_timestamp))
  ) {
    return reason("invalid sale timestamp");
  }
  if (
    payload.barber_username !== undefined &&
    (typeof payload.barber_username !== "string" || payload.barber_username.trim() === "")
  ) {
    return reason("invalid barber username");
  }
  if (!Array.isArray(payload.line_items) || payload.line_items.length === 0) {
    return reason("line_items must be a non-empty array");
  }
  if (!Number.isFinite(payload.total_amount) || !Number.isFinite(payload.cash_amount)) {
    return reason("invalid totals");
  }

  const barber = runOne("SELECT id FROM users WHERE id = ? AND is_active = 1 AND role = 'barber'", [
    payload.barber_id,
  ] as BindParams);
  if (!barber) return reason("invalid barber");

  const lineItems: IngestLine[] = [];
  let sum = 0;
  for (const raw of payload.line_items) {
    if (!isRecord(raw)) return reason("malformed line item");
    const type = raw.type;
    if (type !== "service") {
      return reason(type === "product" ? "product lines are not accepted" : "invalid line type");
    }
    if (!Number.isInteger(raw.item_id) || (raw.item_id as number) <= 0) {
      return reason("invalid line item id");
    }
    if (typeof raw.name !== "string" || raw.name.trim() === "") {
      return reason("invalid line item name");
    }
    if (!Number.isFinite(raw.price) || (raw.price as number) < 0) {
      return reason("invalid line price");
    }
    if (!Number.isInteger(raw.quantity) || (raw.quantity as number) < 1) {
      return reason("invalid line quantity");
    }
    if (!Number.isFinite(raw.line_total)) return reason("invalid line total");
    const price = raw.price as number;
    const quantity = raw.quantity as number;
    const lineTotal = raw.line_total as number;
    if (!nearEqual(lineTotal, price * quantity)) {
      return reason("line total does not match price * quantity");
    }
    sum += lineTotal;
    lineItems.push({
      type,
      itemId: (raw.item_id as number) - 0,
      name: raw.name as string,
      price,
      quantity,
      lineTotal,
    });
  }

  const totalAmount = payload.total_amount as number;
  if (!nearEqual(totalAmount, sum)) return reason("total does not match line items");
  if (!nearEqual(payload.cash_amount as number, totalAmount)) {
    return reason("cash amount differs from total");
  }

  return {
    reason: null,
    lineItems,
    saleUuid: payload.sale_uuid as string,
    barberId: payload.barber_id as number,
    saleTimestamp: payload.sale_timestamp as string,
    totalAmount,
  };
}

function logSkewIfNeeded(stationId: number, saleTimestamp: string): void {
  const skew = Math.abs(Date.now() - Date.parse(saleTimestamp));
  if (skew > CLOCK_SKEW_MS) {
    logSystemEvent(
      "sync_clock_skew",
      `Ingested sale timestamp differs from server clock by ${Math.round(skew / 3600000)}h; original timestamp preserved`,
      stationId,
    );
  }
}

export function startIngestServer(): void {
  if (started) return;
  started = true;

  if (!isDeviceOwnerStation()) {
    logSystemEvent(
      "sync_server_skipped",
      "Device is not the owner station; ingest server not started",
      getDeviceStationId(),
    );
    return;
  }

  let port = DEFAULT_INGEST_PORT;
  const portRow = runOne("SELECT value FROM app_settings WHERE key = 'sync.ingest_port'");
  if (portRow) {
    const parsed = Number.parseInt(portRow[0] as string, 10);
    if (Number.isInteger(parsed) && parsed > 0 && parsed < 65536) port = parsed;
  }

  server = http.createServer((req, res) => {
    const url = req.url || "/";
    if (req.method === "GET" && (url === PROVISION_PATH || url === CATALOG_PATH)) {
      void handleSyncGetRequest(req, res, url === CATALOG_PATH);
      return;
    }
    if (req.method !== "POST" || url !== INGEST_PATH) {
      sendJson(
        res,
        url === INGEST_PATH || url === PROVISION_PATH || url === CATALOG_PATH ? 405 : 404,
        {
          success: false,
          error:
            url === INGEST_PATH || url === PROVISION_PATH || url === CATALOG_PATH
              ? "method not allowed"
              : "not found",
        },
      );
      return;
    }
    void handleIngestRequest(req, res);
  });

  server.on("error", (err: Error) => {
    logSystemEvent("sync_server_error", `Ingest server error: ${err.message}`, getOwnerStationId());
  });

  const ownerId = getOwnerStationId();
  server.listen(port, "0.0.0.0", () => {
    logSystemEvent("sync_server_started", `Owner ingest server listening on port ${port}`, ownerId);
  });
}

async function handleSyncGetRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  wantCatalog: boolean,
): Promise<void> {
  const token = bearerToken(req);
  if (!token) {
    sendJson(res, 401, { success: false, error: "authentication required" });
    return;
  }
  const station = authenticateStation(token);
  if (!station) {
    sendJson(res, 401, { success: false, error: "authentication failed" });
    return;
  }
  if (!station.isActive) {
    sendJson(res, 403, { success: false, error: "station is not active" });
    return;
  }
  if (station.role !== "barber") {
    sendJson(res, 403, { success: false, error: "source station is not a barber station" });
    return;
  }
  if (wantCatalog) {
    const services = runQuery(
      "SELECT id, name, description, price, is_deleted, updated_at FROM services ORDER BY id",
    ).map((r) => ({
      id: r[0] as number,
      name: r[1] as string,
      description: r[2] as string | null,
      price: Number(r[3]),
      isDeleted: r[4] === 1,
      updatedAt: r[5] as string,
    }));
    const barbers = runQuery(
      "SELECT id, username, pin_hash, is_active, updated_at FROM users WHERE role = 'barber' ORDER BY id",
    ).map((r) => ({
      id: r[0] as number,
      username: r[1] as string,
      pinHash: r[2] as string | null,
      isActive: r[3] === 1,
      updatedAt: r[4] as string,
    }));
    logSystemEvent("sync_catalog_served", `Catalog served to station ${station.id}`, station.id);
    sendJson(res, 200, { success: true, generated_at: getUtcNow(), services, barbers });
    return;
  }
  const row = runOne("SELECT station_uuid, label FROM stations WHERE id = ?", [
    station.id,
  ] as BindParams);
  const stationUuid = (row?.[0] as string) ?? "";
  const label = (row?.[1] as string | null) ?? null;
  logSystemEvent("sync_provision_sent", `Provision accepted for station ${station.id}`, station.id);
  sendJson(res, 200, {
    success: true,
    station_id: station.id,
    station_uuid: stationUuid,
    role: station.role,
    label,
  });
}

async function handleIngestRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  try {
    const { buffer, tooLarge } = await readBody(req);
    if (tooLarge) {
      sendJson(res, 413, { success: false, error: "payload too large" });
      return;
    }

    const token = bearerToken(req);
    if (!token) {
      sendJson(res, 401, { success: false, error: "authentication required" });
      return;
    }
    const station = authenticateStation(token);
    if (!station) {
      sendJson(res, 401, { success: false, error: "authentication failed" });
      return;
    }
    if (!station.isActive) {
      sendJson(res, 403, { success: false, error: "station is not active" });
      return;
    }
    if (station.role !== "barber") {
      sendJson(res, 403, { success: false, error: "source station is not a barber station" });
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(buffer.toString("utf8"));
    } catch {
      sendJson(res, 400, { success: false, error: "malformed json body" });
      return;
    }
    if (!isRecord(parsed) || !isRecord(parsed.payload)) {
      sendJson(res, 400, { success: false, error: "missing payload" });
      return;
    }

    const v = validateIngestPayload(parsed.payload, station.id);
    if (v.reason) {
      logSystemEvent("sync_ingest_rejected", `station ${station.id}: ${v.reason}`, station.id);
      sendJson(res, 400, { success: false, error: v.reason });
      return;
    }

    // Idempotency: key is the globally-unique sale_uuid from this source station.
    const existing = runOne("SELECT id FROM sales WHERE sale_uuid = ? AND station_id = ?", [
      v.saleUuid,
      station.id,
    ] as BindParams);
    if (existing) {
      logSystemEvent("sync_ingest_duplicate", `Duplicate delivery for ${v.saleUuid}`, station.id);
      sendJson(res, 200, {
        success: true,
        status: "duplicate",
        sale_uuid: v.saleUuid,
        source_station_id: station.id,
      });
      return;
    }

    let saleId = 0;
    try {
      beginTransaction();
      const result = runSql(
        "INSERT INTO sales (barber_id, station_id, total_amount, cash_amount, is_deleted, created_at, created_by, sale_uuid) VALUES (?, ?, ?, ?, 0, ?, ?, ?)",
        [
          v.barberId,
          station.id,
          v.totalAmount,
          v.totalAmount,
          v.saleTimestamp,
          v.barberId,
          v.saleUuid,
        ] as BindParams,
      );
      saleId = result.lastInsertRowid;
      for (const line of v.lineItems) {
        runSql(
          "INSERT INTO sale_service_lines (sale_id, service_id, name, price, quantity, line_total) VALUES (?, ?, ?, ?, ?, ?)",
          [saleId, line.itemId, line.name, line.price, line.quantity, line.lineTotal] as BindParams,
        );
      }
      commitTransaction();
    } catch (error: unknown) {
      rollbackTransaction();
      const message = error instanceof Error ? error.message : "unknown";
      if (/UNIQUE constraint failed/i.test(message)) {
        sendJson(res, 200, {
          success: true,
          status: "duplicate",
          sale_uuid: v.saleUuid,
          source_station_id: station.id,
        });
        return;
      }
      logSystemEvent("sync_ingest_error", `station ${station.id}: ${message}`, station.id);
      sendJson(res, 500, { success: false, error: "internal ingest failure" });
      return;
    }

    logSkewIfNeeded(station.id, v.saleTimestamp);
    logSystemEvent(
      "sync_ingest_accepted",
      `Ingested sale ${v.saleUuid} (id ${saleId}) from station ${station.id}`,
      station.id,
    );
    sendJson(res, 200, {
      success: true,
      status: "accepted",
      sale_uuid: v.saleUuid,
      source_station_id: station.id,
      local_sale_id: saleId,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "unknown";
    logSystemEvent("sync_ingest_error", `Ingest handler error: ${message}`, getOwnerStationId());
    sendJson(res, 500, { success: false, error: "internal ingest failure" });
  }
}

export function stopIngestServer(): void {
  if (server) {
    server.close();
    server = null;
  }
  started = false;
}
