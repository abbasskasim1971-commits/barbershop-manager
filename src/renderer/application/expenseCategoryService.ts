import { query, insert, update, softDelete } from "../infrastructure/database/databaseService";

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
  const whereClause = includeDeleted ? "" : "WHERE is_deleted = 0";
  return query(`SELECT * FROM expense_categories ${whereClause} ORDER BY name LIMIT ? OFFSET ?`, [
    limit,
    offset,
  ]);
}

export async function getExpenseCategoryById(id: number): Promise<ExpenseCategory | undefined> {
  return query("SELECT * FROM expense_categories WHERE id = ?", [id]);
}

export async function createExpenseCategory(
  name: string,
): Promise<{ changes: number; lastInsertRowid: number }> {
  if (!name || !name.trim()) {
    throw new Error("Category name is required");
  }
  return insert("expense_categories", {
    name: name.trim(),
    is_deleted: 0,
  });
}

export async function updateExpenseCategory(
  id: number,
  name: string,
): Promise<{ changes: number }> {
  if (!name || !name.trim()) {
    throw new Error("Category name is required");
  }
  return update("expense_categories", id, { name: name.trim() });
}

export async function softDeleteExpenseCategory(id: number): Promise<{ changes: number }> {
  return softDelete("expense_categories", id);
}

export async function getActiveExpenseCategories(): Promise<ExpenseCategory[]> {
  return query("SELECT * FROM expense_categories WHERE is_deleted = 0 ORDER BY name");
}

export async function getExpenseCategories(): Promise<ExpenseCategory[]> {
  return query("SELECT * FROM expense_categories WHERE is_deleted = 0 ORDER BY name");
}
