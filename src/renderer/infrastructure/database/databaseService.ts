const authApi = window.auth;

export async function authLogin(username: string, password: string) {
  return authApi.login(username, password);
}

export async function authLoginPin(pin: string) {
  return authApi.loginPin(pin);
}

export async function authLogout(sessionId: string) {
  return authApi.logout(sessionId);
}

export async function authVerifySession(sessionId: string) {
  return authApi.verifySession(sessionId);
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

const syncApi = window.sync;

export async function syncGetDeviceInfo() {
  return syncApi.getDeviceInfo();
}

export async function syncProvision(host: string, port: number, token: string) {
  return syncApi.provision(host, port, token);
}

export async function syncRegisterStation(sessionId: string, label: string) {
  return syncApi.registerStation(sessionId, label);
}

export async function syncGetStatus() {
  return syncApi.getStatus();
}

export async function syncRunNow() {
  return syncApi.runNow();
}

export async function syncListStations(sessionId: string) {
  return syncApi.listStations(sessionId);
}
