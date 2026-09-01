import { query } from "../infrastructure/database/databaseService";

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
  let whereClause = "";
  const params: unknown[] = [];

  if (entityType && entityId) {
    whereClause = "WHERE entity_type = ? AND entity_id = ?";
    params.push(entityType, entityId);
  } else if (entityType) {
    whereClause = "WHERE entity_type = ?";
    params.push(entityType);
  } else if (entityId) {
    whereClause = "WHERE entity_id = ?";
    params.push(entityId);
  }

  params.push(limit, offset);
  return query(
    `SELECT * FROM audit_log ${whereClause} ORDER BY changed_at DESC LIMIT ? OFFSET ?`,
    params,
  );
}

export async function getAuditLogByEntity(
  entityType: string,
  entityId: number,
): Promise<AuditEntry[]> {
  return query(
    "SELECT * FROM audit_log WHERE entity_type = ? AND entity_id = ? ORDER BY changed_at DESC",
    [entityType, entityId],
  );
}

export async function getAuditLogCount(entityType?: string, entityId?: number): Promise<number> {
  let whereClause = "";
  const params: unknown[] = [];

  if (entityType && entityId) {
    whereClause = "WHERE entity_type = ? AND entity_id = ?";
    params.push(entityType, entityId);
  } else if (entityType) {
    whereClause = "WHERE entity_type = ?";
    params.push(entityType);
  } else if (entityId) {
    whereClause = "WHERE entity_id = ?";
    params.push(entityId);
  }

  const result = query(`SELECT COUNT(*) as count FROM audit_log ${whereClause}`, params);
  return (result[0]?.[0] as number) || 0;
}
