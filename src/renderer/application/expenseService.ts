import { query, insert, softDelete, update } from "../infrastructure/database/databaseService";

export async function getAllExpenses(limit = 100, offset = 0) {
  return query(
    "SELECT * FROM expenses WHERE is_deleted = 0 ORDER BY created_at DESC LIMIT ? OFFSET ?",
    [limit, offset],
  );
}

export async function createExpense(category: string, amount: number, description: string) {
  return insert("expenses", { category, amount, description, is_deleted: 0 });
}

export async function softDeleteExpense(id: number) {
  return softDelete("expenses", id);
}

export async function updateExpense(id: number, row: Record<string, unknown>) {
  return update("expenses", id, row);
}

export async function getExpenseCategories() {
  return query("SELECT * FROM expense_categories WHERE is_deleted = 0 ORDER BY name");
}
