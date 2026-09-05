import { ipcMain } from "electron";
import { randomBytes, randomUUID } from "node:crypto";
import { hashToken, stopIngestServer } from "../ingest";
import { callOwnerProvision, startSyncClient, triggerSyncNow } from "../sync/client";
import {
  addAuditLog,
  getDeviceStationId,
  getOwnerStationId,
  getSyncStatus,
  getUtcNow,
  isBarberProvisioned,
  logSystemEvent,
  requireAuth,
  runOne,
  runQuery,
  runSql,
  setSyncClientConfig,
} from "../database";
import type { BindParams } from "sql.js";

function stationInfo(): {
  provisioned: boolean;
  role: string;
  stationId: number;
  stationUuid: string;
  label: string | null;
} {
  const stationId = getDeviceStationId();
  const uuidRow = runOne("SELECT station_uuid FROM stations WHERE id = ?", [
    stationId,
  ] as BindParams);
  const labelRow = runOne("SELECT label FROM stations WHERE id = ?", [stationId] as BindParams);
  return {
    provisioned: isBarberProvisioned(),
    role: isBarberProvisioned() ? "barber" : stationId === getOwnerStationId() ? "owner" : "barber",
    stationId,
    stationUuid: (uuidRow?.[0] as string) || "",
    label: (labelRow?.[0] as string | null) || null,
  };
}

export function registerSyncHandlers(): void {
  ipcMain.handle("sync:getDeviceInfo", async () => {
    return stationInfo();
  });

  ipcMain.handle(
    "sync:provision",
    async (
      _event,
      host: string,
      port: number,
      token: string,
    ): Promise<{ ok: boolean; error?: string; info?: ReturnType<typeof stationInfo> }> => {
      if (typeof host !== "string" || host.trim() === "" || host.length > 255) {
        return { ok: false, error: "invalid owner host" };
      }
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        return { ok: false, error: "invalid owner port" };
      }
      if (typeof token !== "string" || token.trim() === "" || token.length > 512) {
        return { ok: false, error: "invalid station token" };
      }
      if (isBarberProvisioned()) {
        return { ok: false, error: "device is already provisioned" };
      }
      let response;
      try {
        response = await callOwnerProvision(host.trim(), port, token.trim());
      } catch (error) {
        return {
          ok: false,
          error: `owner unreachable: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
      if (response.status !== 200 || response.body.success !== true) {
        return {
          ok: false,
          error: `owner rejected (http ${response.status}): ${String(response.body.error ?? "unknown error")}`,
        };
      }
      const body = response.body as {
        station_uuid?: string;
        station_id?: number;
        role?: string;
        label?: string | null;
      };
      const stationUuid = typeof body.station_uuid === "string" ? body.station_uuid : "";
      if (stationUuid === "") {
        return { ok: false, error: "owner returned no station uuid" };
      }
      const stationId = Number.isInteger(body.station_id) ? (body.station_id as number) : 0;
      if (stationId < 1) {
        return { ok: false, error: "owner returned no station id" };
      }
      setSyncClientConfig(
        { ownerHost: host.trim(), ownerPort: port, token: token.trim() },
        stationUuid,
        stationId,
        (body.label as string | null) ?? null,
      );
      logSystemEvent(
        "sync_provisioned",
        `Device provisioned as barber station ${stationUuid}`,
        getDeviceStationId(),
      );
      stopIngestServer();
      startSyncClient();
      return { ok: true, info: stationInfo() };
    },
  );

  ipcMain.handle(
    "sync:registerStation",
    async (
      _event,
      sessionId: string,
      label: string,
    ): Promise<{
      success: boolean;
      error?: string;
      token?: string;
      stationId?: number;
      stationUuid?: string;
    }> => {
      const session = requireAuth(sessionId, ["owner", "manager"]);
      if (!session) return { success: false, error: "unauthorized" };
      const cleanLabel =
        typeof label === "string" && label.trim() !== "" ? label.trim().slice(0, 100) : null;
      const now = getUtcNow();
      const stationUuid = `station_${randomUUID()}`;
      const rawToken = `tok_${randomBytes(32).toString("hex")}`;
      const result = runSql(
        "INSERT INTO stations (station_uuid, role, label, is_active, created_at, updated_at, api_token_hash) VALUES (?, 'barber', ?, 1, ?, ?, ?)",
        [stationUuid, cleanLabel, now, now, hashToken(rawToken)] as BindParams,
      );
      const stationId = result.lastInsertRowid;
      addAuditLog("station", stationId, "role", "", "barber", `user:${session.userId}`);
      logSystemEvent(
        "sync_station_registered",
        `Barber station registered: ${stationId}`,
        getDeviceStationId(),
      );
      return { success: true, token: rawToken, stationId, stationUuid };
    },
  );

  ipcMain.handle("sync:getStatus", async () => {
    return getSyncStatus();
  });

  ipcMain.handle("sync:runNow", async () => {
    if (!isBarberProvisioned()) return getSyncStatus();
    return triggerSyncNow();
  });

  ipcMain.handle("sync:listStations", async (_event, sessionId: string) => {
    const session = requireAuth(sessionId, ["owner", "manager"]);
    if (!session) return { stations: [] };
    const rows = runQuery(
      "SELECT id, station_uuid, role, label, is_active, created_at, updated_at FROM stations ORDER BY id",
    );
    return {
      stations: rows.map((r) => ({
        id: r[0] as number,
        stationUuid: r[1] as string,
        role: r[2] as string,
        label: (r[3] as string | null) || null,
        isActive: r[4] === 1,
        createdAt: r[5] as string,
        updatedAt: r[6] as string,
      })),
    };
  });
}
