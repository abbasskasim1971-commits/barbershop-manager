import { AuthService } from "./authService";
import { logEvent } from "../infrastructure/database/databaseService";

const api = window.api;

export interface StockAdjustmentResult {
  success: boolean;
  error?: string;
  oldQuantity?: number;
  newQuantity?: number;
}

export async function getAllProducts(limit = 100, offset = 0) {
  const sessionId = AuthService.getSessionId() || "";
  return api.getAllProducts(sessionId, limit, offset, false);
}

export async function getLowStockProducts() {
  const sessionId = AuthService.getSessionId() || "";
  return api.getLowStockProducts(sessionId);
}

export async function updateProductStock(productId: number, newQuantity: number) {
  if (newQuantity < 0) {
    throw new Error("Quantity cannot be negative");
  }
  const sessionId = AuthService.getSessionId() || "";
  return api.updateProductStock(sessionId, productId, newQuantity);
}

export async function addProductStock(
  productId: number,
  quantity: number,
): Promise<StockAdjustmentResult> {
  if (quantity <= 0) {
    throw new Error("Quantity to add must be greater than zero");
  }
  const sessionId = AuthService.getSessionId() || "";
  const result = await api.addProductStock(sessionId, productId, quantity);
  if (result.success) {
    await logEvent(
      sessionId,
      "inventory_added",
      `Stock added for product ${productId}: +${quantity}`,
      1,
    );
  }
  return result;
}

export async function removeProductStock(
  productId: number,
  quantity: number,
): Promise<StockAdjustmentResult> {
  if (quantity <= 0) {
    throw new Error("Quantity to remove must be greater than zero");
  }
  const sessionId = AuthService.getSessionId() || "";
  const result = await api.removeProductStock(sessionId, productId, quantity);
  if (result.success) {
    await logEvent(
      sessionId,
      "inventory_removed",
      `Stock removed for product ${productId}: -${quantity}`,
      1,
    );
  }
  return result;
}

export async function getLowStockCount() {
  const sessionId = AuthService.getSessionId() || "";
  return api.getLowStockCount(sessionId);
}

export async function getActiveProducts() {
  const sessionId = AuthService.getSessionId() || "";
  return api.getActiveProducts(sessionId);
}
