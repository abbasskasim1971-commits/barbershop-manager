import { logEvent } from "../database/databaseService";
import { AuthService } from "../../application/authService";

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

export async function getEvents(limit = 100, offset = 0) {
  const sessionId = AuthService.getSessionId() || "";
  return window.api.getEvents(sessionId, limit, offset);
}

export async function getEventsByStation(stationId: number, limit = 50, offset = 0) {
  const sessionId = AuthService.getSessionId() || "";
  const events = await window.api.getEvents(sessionId, limit, offset);
  return events.filter((e) => e.stationId === stationId);
}

export { logEvent };
