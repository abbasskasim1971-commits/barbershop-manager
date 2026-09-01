import {
  query,
  getOne,
  insert,
  update,
  softDelete,
} from "../infrastructure/database/databaseService";

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
  const whereClause = includeDeleted ? "" : "WHERE is_deleted = 0";
  return query(`SELECT * FROM expenses ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [
    limit,
    offset,
  ]);
}

export async function getExpenseById(id: number): Promise<Expense | undefined> {
  return getOne("SELECT * FROM expenses WHERE id = ?", [id]);
}

export async function createExpense(
  category: string,
  amount: number,
  description: string,
): Promise<{ changes: number; lastInsertRowid: number }> {
  if (!category || !category.trim()) {
    throw new Error("Category is required");
  }
  if (amount <= 0) {
    throw new Error("Amount must be greater than zero");
  }

  const result = await insert("expenses", {
    category: category.trim(),
    amount,
    description: description?.trim() || "",
    is_deleted: 0,
  });

  return result;
}

export async function updateExpense(
  id: number,
  category: string,
  amount: number,
  description: string,
): Promise<{ changes: number }> {
  if (!category || !category.trim()) {
    throw new Error("Category is required");
  }
  if (amount <= 0) {
    throw new Error("Amount must be greater than zero");
  }

  return update("expenses", id, {
    category: category.trim(),
    amount,
    description: description?.trim() || "",
  });
}

export async function softDeleteExpense(id: number): Promise<{ changes: number }> {
  return softDelete("expenses", id);
}
