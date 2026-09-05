import { AuthService } from "./authService";

const api = window.api;

export async function getEodStatus() {
  const sessionId = AuthService.getSessionId() || "";
  return api.getEodStatus(sessionId);
}

export async function getEodSummary(date: string) {
  const sessionId = AuthService.getSessionId() || "";
  return api.getEodSummary(sessionId, date);
}

export async function closeDay(date: string, countedCash: number) {
  const sessionId = AuthService.getSessionId() || "";
  return api.closeDay(sessionId, date, countedCash);
}

export async function getEodClosings(limit?: number, offset?: number) {
  const sessionId = AuthService.getSessionId() || "";
  return api.getEodClosings(sessionId, limit, offset);
}
