import { query, logEvent } from "../database/databaseService";

export type EventType =
  | "login"
  | "logout"
  | "sync_push"
  | "sync_pull"
  | "sync_error"
  | "eod_close"
  | "backup"
  | "restore"
  | "sale_created"
  | "sale_corrected"
  | "commission_change";

export interface SystemEventRecord {
  id?: number;
  eventType: EventType;
  details: string;
  stationId: number;
  timestamp: string;
}

export async function getEvents(limit = 100, offset = 0): Promise<unknown[][]> {
  return query("SELECT * FROM system_events ORDER BY timestamp DESC LIMIT ? OFFSET ?", [
    limit,
    offset,
  ]);
}

export async function getEventsByStation(
  stationId: number,
  limit = 50,
  offset = 0,
): Promise<unknown[][]> {
  return query(
    "SELECT * FROM system_events WHERE station_id = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?",
    [stationId, limit, offset],
  );
}

export { logEvent };
