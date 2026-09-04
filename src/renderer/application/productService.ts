import { AuthService } from "./authService";

const api = window.api;

export interface Product {
  id: number;
  name: string;
  price: number;
  costPrice: number;
  quantity: number;
  lowStockThreshold: number;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function getAllProducts(
  limit = 100,
  offset = 0,
  includeDeleted = false,
): Promise<Product[]> {
  const sessionId = AuthService.getSessionId() || "";
  return api.getAllProducts(sessionId, limit, offset, includeDeleted);
}

export async function getLowStockProducts(): Promise<Product[]> {
  const sessionId = AuthService.getSessionId() || "";
  return api.getLowStockProducts(sessionId);
}

export async function getProductById(id: number): Promise<Product | undefined> {
  const sessionId = AuthService.getSessionId() || "";
  return api.getProductById(sessionId, id);
}

export async function createProduct(
  name: string,
  price: number,
  costPrice: number,
  quantity: number,
  lowStockThreshold: number,
): Promise<{ success: boolean; error?: string; id?: number }> {
  if (!name || !name.trim()) {
    throw new Error("Product name is required");
  }
  if (price < 0) {
    throw new Error("Selling price cannot be negative");
  }
  if (costPrice < 0) {
    throw new Error("Cost price cannot be negative");
  }
  if (quantity < 0) {
    throw new Error("Quantity cannot be negative");
  }
  if (lowStockThreshold < 0) {
    throw new Error("Low stock threshold cannot be negative");
  }

  const sessionId = AuthService.getSessionId() || "";
  const result = await api.createProduct(
    sessionId,
    name,
    price,
    costPrice,
    quantity,
    lowStockThreshold,
  );

  return result;
}

export async function updateProduct(
  id: number,
  name: string,
  price: number,
  costPrice: number,
  quantity: number,
  lowStockThreshold: number,
): Promise<{ success: boolean; error?: string; changes?: number }> {
  if (!name || !name.trim()) {
    throw new Error("Product name is required");
  }
  if (price < 0) {
    throw new Error("Selling price cannot be negative");
  }
  if (costPrice < 0) {
    throw new Error("Cost price cannot be negative");
  }
  if (quantity < 0) {
    throw new Error("Quantity cannot be negative");
  }
  if (lowStockThreshold < 0) {
    throw new Error("Low stock threshold cannot be negative");
  }

  const sessionId = AuthService.getSessionId() || "";
  const result = await api.updateProduct(
    sessionId,
    id,
    name,
    price,
    costPrice,
    quantity,
    lowStockThreshold,
  );

  return result;
}

export async function softDeleteProduct(
  id: number,
): Promise<{ success: boolean; error?: string; changes?: number }> {
  const sessionId = AuthService.getSessionId() || "";
  const result = await api.softDeleteProduct(sessionId, id);

  return result;
}

export async function updateProductStock(
  productId: number,
  newQuantity: number,
): Promise<{ success: boolean; error?: string; changes?: number }> {
  if (newQuantity < 0) {
    throw new Error("Quantity cannot be negative");
  }
  const sessionId = AuthService.getSessionId() || "";
  return api.updateProductStock(sessionId, productId, newQuantity);
}

export async function getLowStockCount(): Promise<number> {
  const sessionId = AuthService.getSessionId() || "";
  return api.getLowStockCount(sessionId);
}

export async function getActiveProducts(): Promise<Product[]> {
  const sessionId = AuthService.getSessionId() || "";
  return api.getActiveProducts(sessionId);
}
