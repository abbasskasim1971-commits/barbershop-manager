import { AuthService } from "./authService";

const api = window.api;

export interface Expense {
  id: number;
  category: string;
  amount: number;
  description: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function getAllExpenses(
  limit = 100,
  offset = 0,
  includeDeleted = false,
): Promise<Expense[]> {
  const sessionId = AuthService.getSessionId() || "";
  return api.getAllExpenses(sessionId, limit, offset, includeDeleted);
}

export async function getExpenseById(id: number): Promise<Expense | undefined> {
  const sessionId = AuthService.getSessionId() || "";
  return api.getExpenseById(sessionId, id);
}

export async function createExpense(
  category: string,
  amount: number,
  description: string,
): Promise<{ success: boolean; error?: string; id?: number }> {
  if (!category || !category.trim()) {
    throw new Error("Category is required");
  }
  if (amount <= 0) {
    throw new Error("Amount must be greater than zero");
  }

  const sessionId = AuthService.getSessionId() || "";
  const result = await api.createExpense(sessionId, category, amount, description);

  return result;
}

export async function updateExpense(
  id: number,
  category: string,
  amount: number,
  description: string,
): Promise<{ success: boolean; error?: string; changes?: number }> {
  if (!category || !category.trim()) {
    throw new Error("Category is required");
  }
  if (amount <= 0) {
    throw new Error("Amount must be greater than zero");
  }

  const sessionId = AuthService.getSessionId() || "";
  const result = await api.updateExpense(sessionId, id, category, amount, description);

  return result;
}

export async function softDeleteExpense(
  id: number,
): Promise<{ success: boolean; error?: string; changes?: number }> {
  const sessionId = AuthService.getSessionId() || "";
  const result = await api.softDeleteExpense(sessionId, id);

  return result;
}
