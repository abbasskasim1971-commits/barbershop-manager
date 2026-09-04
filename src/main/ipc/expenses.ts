import { ipcMain } from "electron";
import {
  requireAuth,
  getUtcNow,
  runOne,
  runSql,
  runQuery,
  addAuditLog,
  mapCategories,
  mapExpenses,
  rowToCategory,
} from "../database";
import type { BindParams } from "sql.js";

export function registerExpenseHandlers(): void {
  ipcMain.handle(
    "expenseCategories:getAll",
    async (_event, sessionId: string, limit = 100, offset = 0, includeDeleted = false) => {
      const session = requireAuth(sessionId, ["owner", "manager"]);
      if (!session) return [];
      const whereClause = includeDeleted ? "" : "WHERE is_deleted = 0";
      return mapCategories(
        runQuery(`SELECT * FROM expense_categories ${whereClause} ORDER BY name LIMIT ? OFFSET ?`, [
          limit,
          offset,
        ] as BindParams),
      );
    },
  );

  ipcMain.handle("expenseCategories:getById", async (_event, sessionId: string, id: number) => {
    const session = requireAuth(sessionId, ["owner", "manager"]);
    if (!session) return undefined;
    const row = runOne("SELECT * FROM expense_categories WHERE id = ? AND is_deleted = 0", [
      id,
    ] as BindParams);
    return row ? rowToCategory(row) : undefined;
  });

  ipcMain.handle("expenseCategories:getActive", async (_event, sessionId: string) => {
    const session = requireAuth(sessionId, ["owner", "manager"]);
    if (!session) return [];
    return mapCategories(
      runQuery("SELECT * FROM expense_categories WHERE is_deleted = 0 ORDER BY name"),
    );
  });

  ipcMain.handle("expenseCategories:create", async (_event, sessionId: string, name: string) => {
    const session = requireAuth(sessionId, ["owner", "manager"]);
    if (!session) return { success: false, error: "Unauthorized" };

    if (!name || !name.trim()) {
      return { success: false, error: "Category name is required" };
    }

    const result = runSql(
      "INSERT INTO expense_categories (name, is_deleted, created_at) VALUES (?, ?, ?)",
      [name.trim(), 0, getUtcNow()] as BindParams,
    );

    addAuditLog(
      "expense_categories",
      result.lastInsertRowid,
      "name",
      null,
      name.trim(),
      `user:${session.userId}`,
    );

    return { success: true, id: result.lastInsertRowid };
  });

  ipcMain.handle(
    "expenseCategories:update",
    async (_event, sessionId: string, id: number, name: string) => {
      const session = requireAuth(sessionId, ["owner", "manager"]);
      if (!session) return { success: false, error: "Unauthorized" };

      if (!name || !name.trim()) {
        return { success: false, error: "Category name is required" };
      }

      const oldCategory = runOne("SELECT * FROM expense_categories WHERE id = ?", [
        id,
      ] as BindParams);
      if (!oldCategory) {
        return { success: false, error: "Category not found" };
      }

      const result = runSql("UPDATE expense_categories SET name = ? WHERE id = ?", [
        name.trim(),
        id,
      ] as BindParams);

      addAuditLog(
        "expense_categories",
        id,
        "name",
        oldCategory[1] as string,
        name.trim(),
        `user:${session.userId}`,
      );

      return { success: true, changes: result.changes };
    },
  );

  ipcMain.handle("expenseCategories:delete", async (_event, sessionId: string, id: number) => {
    const session = requireAuth(sessionId, ["owner", "manager"]);
    if (!session) return { success: false, error: "Unauthorized" };

    const oldCategory = runOne("SELECT * FROM expense_categories WHERE id = ?", [id] as BindParams);
    if (!oldCategory) {
      return { success: false, error: "Category not found" };
    }

    const result = runSql("UPDATE expense_categories SET is_deleted = 1 WHERE id = ?", [
      id,
    ] as BindParams);

    addAuditLog("expense_categories", id, "is_deleted", "0", "1", `user:${session.userId}`);

    return { success: true, changes: result.changes };
  });

  ipcMain.handle(
    "expenses:getAll",
    async (_event, sessionId: string, limit = 100, offset = 0, includeDeleted = false) => {
      const session = requireAuth(sessionId, ["owner", "manager"]);
      if (!session) return [];
      const whereClause = includeDeleted ? "" : "WHERE is_deleted = 0";
      return mapExpenses(
        runQuery(
          `SELECT * FROM expenses ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
          [limit, offset] as BindParams,
        ),
      );
    },
  );

  ipcMain.handle("expenses:getById", async (_event, sessionId: string, id: number) => {
    const session = requireAuth(sessionId, ["owner", "manager"]);
    if (!session) return undefined;
    const row = runOne("SELECT * FROM expenses WHERE id = ? AND is_deleted = 0", [
      id,
    ] as BindParams);
    return row
      ? {
          id: row[0] as number,
          category: row[1] as string,
          amount: row[2] as number,
          description: row[3] as string,
          isDeleted: row[4] === 1,
          createdAt: row[5] as string,
          updatedAt: row[6] as string,
        }
      : undefined;
  });

  ipcMain.handle(
    "expenses:create",
    async (_event, sessionId: string, category: string, amount: number, description: string) => {
      const session = requireAuth(sessionId, ["owner", "manager"]);
      if (!session) return { success: false, error: "Unauthorized" };

      if (!category || !category.trim()) {
        return { success: false, error: "Category is required" };
      }
      if (amount <= 0) {
        return { success: false, error: "Amount must be greater than zero" };
      }

      const now = getUtcNow();
      const result = runSql(
        "INSERT INTO expenses (category, amount, description, is_deleted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        [category.trim(), amount, description?.trim() || "", 0, now, now] as BindParams,
      );

      addAuditLog(
        "expenses",
        result.lastInsertRowid,
        "category",
        null,
        category.trim(),
        `user:${session.userId}`,
      );
      addAuditLog(
        "expenses",
        result.lastInsertRowid,
        "amount",
        null,
        String(amount),
        `user:${session.userId}`,
      );
      addAuditLog(
        "expenses",
        result.lastInsertRowid,
        "description",
        null,
        description?.trim() || "",
        `user:${session.userId}`,
      );

      return { success: true, id: result.lastInsertRowid };
    },
  );

  ipcMain.handle(
    "expenses:update",
    async (
      _event,
      sessionId: string,
      id: number,
      category: string,
      amount: number,
      description: string,
    ) => {
      const session = requireAuth(sessionId, ["owner", "manager"]);
      if (!session) return { success: false, error: "Unauthorized" };

      if (!category || !category.trim()) {
        return { success: false, error: "Category is required" };
      }
      if (amount <= 0) {
        return { success: false, error: "Amount must be greater than zero" };
      }

      const oldExpense = runOne("SELECT * FROM expenses WHERE id = ?", [id] as BindParams);
      if (!oldExpense) {
        return { success: false, error: "Expense not found" };
      }

      const result = runSql(
        "UPDATE expenses SET category = ?, amount = ?, description = ?, updated_at = ? WHERE id = ?",
        [category.trim(), amount, description?.trim() || "", getUtcNow(), id] as BindParams,
      );

      addAuditLog(
        "expenses",
        id,
        "category",
        oldExpense[1] as string,
        category.trim(),
        `user:${session.userId}`,
      );
      addAuditLog(
        "expenses",
        id,
        "amount",
        String(oldExpense[2]),
        String(amount),
        `user:${session.userId}`,
      );
      addAuditLog(
        "expenses",
        id,
        "description",
        oldExpense[3] as string | null,
        description?.trim() || "",
        `user:${session.userId}`,
      );

      return { success: true, changes: result.changes };
    },
  );

  ipcMain.handle("expenses:delete", async (_event, sessionId: string, id: number) => {
    const session = requireAuth(sessionId, ["owner", "manager"]);
    if (!session) return { success: false, error: "Unauthorized" };

    const oldExpense = runOne("SELECT * FROM expenses WHERE id = ?", [id] as BindParams);
    if (!oldExpense) {
      return { success: false, error: "Expense not found" };
    }

    const result = runSql("UPDATE expenses SET is_deleted = 1 WHERE id = ?", [id] as BindParams);

    addAuditLog("expenses", id, "is_deleted", "0", "1", `user:${session.userId}`);

    return { success: true, changes: result.changes };
  });

  ipcMain.handle("expenses:getCategories", async (_event, sessionId: string) => {
    const session = requireAuth(sessionId, ["owner", "manager"]);
    if (!session) return [];
    return mapCategories(
      runQuery("SELECT * FROM expense_categories WHERE is_deleted = 0 ORDER BY name"),
    );
  });
}
