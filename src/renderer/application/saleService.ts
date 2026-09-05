import { AuthService } from "./authService";

const api = window.api;

export async function getSale(id: number) {
  const sessionId = AuthService.getSessionId() || "";
  return api.getSaleById(sessionId, id);
}

export async function getAllSales(limit = 100, offset = 0) {
  const sessionId = AuthService.getSessionId() || "";
  return api.getAllSales(sessionId, limit, offset);
}

export type SaleLineInput = {
  type: "service" | "product";
  itemId: number;
  name: string;
  quantity: number;
};

export async function createSale(
  barberId: number,
  lines: SaleLineInput[],
): Promise<{ success: boolean; error?: string; id?: number; totalAmount?: number }> {
  const sessionId = AuthService.getSessionId() || "";
  const result = await api.createSale(sessionId, barberId, lines);
  return result;
}

export async function correctSale(saleId: number): Promise<{ success: boolean; error?: string }> {
  const sessionId = AuthService.getSessionId() || "";
  const result = await api.correctSale(sessionId, saleId);
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

export async function getSaleLines(saleId: number) {
  const sessionId = AuthService.getSessionId() || "";
  return api.getSaleLines(sessionId, saleId);
}

export async function getServices() {
  const sessionId = AuthService.getSessionId() || "";
  return api.getActiveServices(sessionId);
}

export async function getProducts() {
  const sessionId = AuthService.getSessionId() || "";
  return api.getActiveProducts(sessionId);
}

export async function getBarbers() {
  const sessionId = AuthService.getSessionId() || "";
  return window.auth.getActiveBarbers(sessionId);
}
