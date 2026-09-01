import { AuthService } from "./authService";

const api = window.api;

export async function getAllProducts(limit = 100, offset = 0) {
  const sessionId = AuthService.getSessionId() || "";
  return api.getAllProducts(sessionId, limit, offset, false);
}

export async function getLowStockProducts(threshold = 5) {
  const sessionId = AuthService.getSessionId() || "";
  return api.getLowStockProducts(sessionId, threshold);
}

export async function updateProductStock(productId: number, newQuantity: number) {
  if (newQuantity < 0) {
    throw new Error("Quantity cannot be negative");
  }
  const sessionId = AuthService.getSessionId() || "";
  return api.updateProductStock(sessionId, productId, newQuantity);
}

export async function getLowStockCount() {
  const sessionId = AuthService.getSessionId() || "";
  return api.getLowStockCount(sessionId);
}
