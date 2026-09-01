const authApi = window.auth;
const api = window.api;

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

export async function logEvent(
  sessionId: string,
  eventType: string,
  details: string,
  stationId?: number,
) {
  return api.logEvent(sessionId, eventType, details, stationId);
}

export async function getEvents(sessionId: string, limit?: number, offset?: number) {
  return api.getEvents(sessionId, limit, offset);
}

export async function getDbPath(): Promise<string> {
  return api.getDbPath();
}
