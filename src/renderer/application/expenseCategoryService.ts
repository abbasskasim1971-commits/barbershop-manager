import { AuthService } from "./authService";

const api = window.api;

export interface ExpenseCategory {
  id: number;
  name: string;
  isDeleted: boolean;
  createdAt: string;
}

export async function getAllExpenseCategories(
  limit = 100,
  offset = 0,
  includeDeleted = false,
): Promise<ExpenseCategory[]> {
  const sessionId = AuthService.getSessionId() || "";
  return api.getAllExpenseCategories(sessionId, limit, offset, includeDeleted);
}

export async function getExpenseCategoryById(id: number): Promise<ExpenseCategory | undefined> {
  const sessionId = AuthService.getSessionId() || "";
  return api.getExpenseCategoryById(sessionId, id);
}

export async function createExpenseCategory(
  name: string,
): Promise<{ success: boolean; error?: string; id?: number }> {
  if (!name || !name.trim()) {
    throw new Error("Category name is required");
  }
  const sessionId = AuthService.getSessionId() || "";
  const result = await api.createExpenseCategory(sessionId, name);

  return result;
}

export async function updateExpenseCategory(
  id: number,
  name: string,
): Promise<{ success: boolean; error?: string; changes?: number }> {
  if (!name || !name.trim()) {
    throw new Error("Category name is required");
  }
  const sessionId = AuthService.getSessionId() || "";
  const result = await api.updateExpenseCategory(sessionId, id, name);

  return result;
}

export async function softDeleteExpenseCategory(
  id: number,
): Promise<{ success: boolean; error?: string; changes?: number }> {
  const sessionId = AuthService.getSessionId() || "";
  const result = await api.softDeleteExpenseCategory(sessionId, id);

  return result;
}

export async function getActiveExpenseCategories(): Promise<ExpenseCategory[]> {
  const sessionId = AuthService.getSessionId() || "";
  return api.getActiveExpenseCategories(sessionId);
}

export async function getExpenseCategories(): Promise<ExpenseCategory[]> {
  const sessionId = AuthService.getSessionId() || "";
  return api.getActiveExpenseCategories(sessionId);
}
