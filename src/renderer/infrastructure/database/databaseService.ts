const api = window.api;

export async function query<T = unknown>(sql: string, params?: unknown[]): Promise<T[][]> {
  return (await api.query(sql, params)) as T[][];
}

export async function getOne<T = unknown>(sql: string, params?: unknown[]): Promise<T | undefined> {
  return (await api.getOne(sql, params)) as T | undefined;
}

export async function runSql(
  sql: string,
  params?: unknown[],
): Promise<{ changes: number; lastInsertRowid: number }> {
  return (await api.runSql(sql, params)) as { changes: number; lastInsertRowid: number };
}

export async function insert(table: string, row: Record<string, unknown>) {
  return api.insert(table, row);
}

export async function update(table: string, id: number, row: Record<string, unknown>) {
  return api.update(table, id, row);
}

export async function softDelete(table: string, id: number) {
  return api.softDelete(table, id);
}

export async function getDbPath(): Promise<string> {
  return api.getDbPath();
}

export async function addMigration(name: string) {
  return api.addMigration(name);
}

export async function logEvent(eventType: string, details: string, stationId?: number) {
  return api.logEvent(eventType, details, stationId);
}

export async function getEvents(limit?: number, offset?: number) {
  return (await api.getEvents(limit, offset)) as unknown[][];
}
