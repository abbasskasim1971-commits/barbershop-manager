import { AuthService } from "./authService";

const api = window.api;

export interface Service {
  id: number;
  name: string;
  description: string;
  price: number;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function getAllServices(
  limit = 100,
  offset = 0,
  includeDeleted = false,
): Promise<Service[]> {
  const sessionId = AuthService.getSessionId() || "";
  return api.getAllServices(sessionId, limit, offset, includeDeleted);
}

export async function getServiceById(id: number): Promise<Service | undefined> {
  const sessionId = AuthService.getSessionId() || "";
  return api.getServiceById(sessionId, id);
}

export async function createService(
  name: string,
  description: string,
  price: number,
): Promise<{ success: boolean; error?: string; id?: number }> {
  if (!name || !name.trim()) {
    throw new Error("Service name is required");
  }
  if (price < 0) {
    throw new Error("Price cannot be negative");
  }

  const sessionId = AuthService.getSessionId() || "";
  const result = await api.createService(sessionId, name, description, price);

  return result;
}

export async function updateService(
  id: number,
  name: string,
  description: string,
  price: number,
): Promise<{ success: boolean; error?: string; changes?: number }> {
  if (!name || !name.trim()) {
    throw new Error("Service name is required");
  }
  if (price < 0) {
    throw new Error("Price cannot be negative");
  }

  const sessionId = AuthService.getSessionId() || "";
  const result = await api.updateService(sessionId, id, name, description, price);

  return result;
}

export async function softDeleteService(
  id: number,
): Promise<{ success: boolean; error?: string; changes?: number }> {
  const sessionId = AuthService.getSessionId() || "";
  const result = await api.softDeleteService(sessionId, id);

  return result;
}

export async function getActiveServices(): Promise<Service[]> {
  const sessionId = AuthService.getSessionId() || "";
  return api.getActiveServices(sessionId);
}
