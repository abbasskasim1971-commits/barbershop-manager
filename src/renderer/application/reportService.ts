import { AuthService } from "./authService";

const api = window.api;

export async function getReportPresetRange(preset: "daily" | "weekly" | "monthly", date?: string) {
  const sessionId = AuthService.getSessionId() || "";
  return api.getReportPresetRange(sessionId, preset, date);
}

export async function getReport(
  report: ReportName,
  startDate: string,
  endDate: string,
  barberId?: number,
) {
  const sessionId = AuthService.getSessionId() || "";
  return api.getReport(sessionId, report, startDate, endDate, barberId);
}

export async function printReport(
  report: ReportName,
  startDate: string,
  endDate: string,
  barberId?: number,
) {
  const sessionId = AuthService.getSessionId() || "";
  return api.printReport(sessionId, report, startDate, endDate, barberId);
}

export async function exportReport(
  report: ReportName,
  startDate: string,
  endDate: string,
  barberId?: number,
) {
  const sessionId = AuthService.getSessionId() || "";
  return api.exportReport(sessionId, report, startDate, endDate, barberId);
}
