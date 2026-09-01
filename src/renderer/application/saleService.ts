import { AuthService } from "./authService";
import { logEvent } from "../infrastructure/database/databaseService";

const api = window.api;

export async function getSale(id: number) {
  const sessionId = AuthService.getSessionId() || "";
  return api.getSaleById(sessionId, id);
}

export async function getAllSales(limit = 100, offset = 0) {
  const sessionId = AuthService.getSessionId() || "";
  return api.getAllSales(sessionId, limit, offset);
}

export async function createSale(data: {
  barberId: number;
  stationId: number;
  totalAmount: number;
  cashAmount: number;
  createdBy: number;
  lines: Array<{
    type: "service" | "product";
    itemId: number;
    name: string;
    price: number;
    costPrice?: number;
    quantity: number;
  }>;
}) {
  const sessionId = AuthService.getSessionId() || "";
  const result = await api.createSale(
    sessionId,
    data.barberId,
    data.stationId,
    data.totalAmount,
    data.cashAmount,
    data.createdBy,
    data.lines,
  );
  await logEvent(sessionId, "sale_created", `Sale created: ${result.id}`, data.stationId);
  return result;
}

export async function correctSale(saleId: number) {
  const sessionId = AuthService.getSessionId() || "";
  const result = await api.correctSale(sessionId, saleId);
  await logEvent(sessionId, "sale_corrected", `Sale corrected: ${saleId}`, 1);
  return result;
}

export async function getSalesForBarber(barberId: number, date: string) {
  const sessionId = AuthService.getSessionId() || "";
  return api.getSalesForBarber(sessionId, barberId, date);
}

export async function getCommissionForBarber(barberId: number, startDate: string, endDate: string) {
  const sessionId = AuthService.getSessionId() || "";
  return api.getCommissionDues(sessionId, barberId, startDate, endDate);
}
