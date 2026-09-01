import { AuthService } from "./authService";

const api = window.api;

export async function getCommissionRate(barberId: number) {
  const sessionId = AuthService.getSessionId() || "";
  return api.getCommissionRate(sessionId, barberId);
}

export async function getCommissionDues(barberId: number, startDate: string, endDate: string) {
  const sessionId = AuthService.getSessionId() || "";
  return api.getCommissionDues(sessionId, barberId, startDate, endDate);
}

export async function setCommissionRate(barberId: number, rate: number) {
  const sessionId = AuthService.getSessionId() || "";
  return api.setCommissionRate(sessionId, barberId, rate);
}
