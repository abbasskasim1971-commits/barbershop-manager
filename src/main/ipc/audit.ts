import { ipcMain } from 'electron';
import {
  requireAuth,
  verifySession,
  runQuery,
  logSystemEvent,
  mapAuditEntries,
  mapEvents,
} from '../database';
import type { BindParams } from 'sql.js';

export function registerAuditHandlers(): void {
  ipcMain.handle('log-event', (_event, sessionId: string, eventType: string, details: string, stationId?: number) => {
    const session = verifySession(sessionId);
    if (!session) return;
    logSystemEvent(eventType, details, stationId || 1);
  });

  ipcMain.handle('get-events', (_event, sessionId: string, limit: number, offset: number) => {
    const session = verifySession(sessionId);
    if (!session) return [];
    return mapEvents(runQuery('SELECT * FROM system_events ORDER BY timestamp DESC LIMIT ? OFFSET ?', [limit, offset] as BindParams));
  });

  ipcMain.handle('auditLog:getAll', async (_event, sessionId: string, limit = 100, offset = 0, entityType?: string, entityId?: number) => {
    const session = requireAuth(sessionId, ['owner', 'manager']);
    if (!session) return [];

    let whereClause = "";
    const params: BindParams = [];

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
    return mapAuditEntries(runQuery(`SELECT * FROM audit_log ${whereClause} ORDER BY changed_at DESC LIMIT ? OFFSET ?`, params));
  });

  ipcMain.handle('auditLog:getByEntity', async (_event, sessionId: string, entityType: string, entityId: number) => {
    const session = requireAuth(sessionId, ['owner', 'manager']);
    if (!session) return [];
    return mapAuditEntries(
      runQuery(
        'SELECT * FROM audit_log WHERE entity_type = ? AND entity_id = ? ORDER BY changed_at DESC',
        [entityType, entityId] as BindParams
      )
    );
  });

  ipcMain.handle('auditLog:getCount', async (_event, sessionId: string, entityType?: string, entityId?: number) => {
    const session = requireAuth(sessionId, ['owner', 'manager']);
    if (!session) return 0;

    let whereClause = "";
    const params: BindParams = [];

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

    const result = runQuery(`SELECT COUNT(*) as count FROM audit_log ${whereClause}`, params);
    return (result[0]?.[0] as number) || 0;
  });
}
