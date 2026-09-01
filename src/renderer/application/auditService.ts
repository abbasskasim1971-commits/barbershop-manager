import { AuthService } from "./authService";

const api = window.api;

export interface AuditEntry {
  id: number;
  entityType: string;
  entityId: number;
  field: string;
  oldValue: string;
  newValue: string;
  changedBy: string;
  changedAt: string;
}

export async function getAuditLog(
  limit = 100,
  offset = 0,
  entityType?: string,
  entityId?: number,
): Promise<AuditEntry[]> {
  const sessionId = AuthService.getSessionId() || "";
  return api.getAuditLog(sessionId, limit, offset, entityType, entityId);
}

export async function getAuditLogByEntity(
  entityType: string,
  entityId: number,
): Promise<AuditEntry[]> {
  const sessionId = AuthService.getSessionId() || "";
  return api.getAuditLogByEntity(sessionId, entityType, entityId);
}

export async function getAuditLogCount(entityType?: string, entityId?: number): Promise<number> {
  const sessionId = AuthService.getSessionId() || "";
  return api.getAuditLogCount(sessionId, entityType, entityId);
}
