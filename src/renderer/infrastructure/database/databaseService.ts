const api = window.api;
const authApi = window.auth;

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

// Authentication methods
export async function authLogin(username: string, password: string, stationId: number) {
  return authApi.login(username, password, stationId);
}

export async function authLoginPin(pin: string, stationId: number) {
  return authApi.loginPin(pin, stationId);
}

export async function authLogout(sessionId: string) {
  return authApi.logout(sessionId);
}

export async function authVerifySession(sessionId: string) {
  return authApi.verifySession(sessionId);
}

export async function authGetCurrentUser(sessionId: string) {
  return authApi.getCurrentUser(sessionId);
}

export async function authChangePassword(
  sessionId: string,
  oldPassword: string,
  newPassword: string,
) {
  return authApi.changePassword(sessionId, oldPassword, newPassword);
}

export async function authSetPin(sessionId: string, pin: string) {
  return authApi.setPin(sessionId, pin);
}

export async function authCreateUser(
  sessionId: string,
  username: string,
  role: "owner" | "manager" | "barber",
  password?: string,
  pin?: string,
) {
  return authApi.createUser(sessionId, username, role, password, pin);
}

export async function authDeactivateUser(sessionId: string, userId: number) {
  return authApi.deactivateUser(sessionId, userId);
}

export async function authListUsers(sessionId: string) {
  return authApi.listUsers(sessionId);
}

export async function authCheckOwnerExists() {
  return authApi.checkOwnerExists();
}

export async function authFirstRunSetup(username: string, password: string) {
  return authApi.firstRunSetup(username, password);
}
