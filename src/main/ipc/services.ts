import { ipcMain } from "electron";
import {
  requireAuth,
  getUtcNow,
  runOne,
  runSql,
  runQuery,
  addAuditLog,
  logSystemEvent,
  mapServices,
  rowToService,
} from "../database";
import type { BindParams } from "sql.js";

export function registerServiceHandlers(): void {
  ipcMain.handle(
    "services:getAll",
    async (_event, sessionId: string, limit = 100, offset = 0, includeDeleted = false) => {
      const session = requireAuth(sessionId, ["owner", "manager"]);
      if (!session) return [];
      const whereClause = includeDeleted ? "" : "WHERE is_deleted = 0";
      return mapServices(
        runQuery(`SELECT * FROM services ${whereClause} ORDER BY name LIMIT ? OFFSET ?`, [
          limit,
          offset,
        ] as BindParams),
      );
    },
  );

  ipcMain.handle("services:getById", async (_event, sessionId: string, id: number) => {
    const session = requireAuth(sessionId, ["owner", "manager"]);
    if (!session) return undefined;
    const row = runOne("SELECT * FROM services WHERE id = ? AND is_deleted = 0", [
      id,
    ] as BindParams);
    return row ? rowToService(row) : undefined;
  });

  ipcMain.handle("services:getActive", async (_event, sessionId: string) => {
    const session = requireAuth(sessionId, ["owner", "manager", "barber"]);
    if (!session) return [];
    return mapServices(runQuery("SELECT * FROM services WHERE is_deleted = 0 ORDER BY name"));
  });

  ipcMain.handle(
    "services:create",
    async (_event, sessionId: string, name: string, description: string, price: number) => {
      const session = requireAuth(sessionId, ["owner", "manager"]);
      if (!session) return { success: false, error: "Unauthorized" };

      if (!name || !name.trim()) {
        return { success: false, error: "Service name is required" };
      }
      if (price < 0) {
        return { success: false, error: "Price cannot be negative" };
      }

      const now = getUtcNow();
      const result = runSql(
        "INSERT INTO services (name, description, price, is_deleted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        [name.trim(), description?.trim() || "", price, 0, now, now] as BindParams,
      );

      addAuditLog(
        "services",
        result.lastInsertRowid,
        "name",
        null,
        name.trim(),
        `user:${session.userId}`,
      );
      addAuditLog(
        "services",
        result.lastInsertRowid,
        "description",
        null,
        description?.trim() || "",
        `user:${session.userId}`,
      );
      addAuditLog(
        "services",
        result.lastInsertRowid,
        "price",
        null,
        String(price),
        `user:${session.userId}`,
      );
      logSystemEvent("service_created", `Service created: ${name.trim()} (${price} IQD)`, 1);

      return { success: true, id: result.lastInsertRowid };
    },
  );

  ipcMain.handle(
    "services:update",
    async (
      _event,
      sessionId: string,
      id: number,
      name: string,
      description: string,
      price: number,
    ) => {
      const session = requireAuth(sessionId, ["owner", "manager"]);
      if (!session) return { success: false, error: "Unauthorized" };

      if (!name || !name.trim()) {
        return { success: false, error: "Service name is required" };
      }
      if (price < 0) {
        return { success: false, error: "Price cannot be negative" };
      }

      const oldService = runOne("SELECT * FROM services WHERE id = ?", [id] as BindParams);
      if (!oldService) {
        return { success: false, error: "Service not found" };
      }

      const result = runSql(
        "UPDATE services SET name = ?, description = ?, price = ?, updated_at = ? WHERE id = ?",
        [name.trim(), description?.trim() || "", price, getUtcNow(), id] as BindParams,
      );

      const oldName = oldService[1] as string;
      const oldDesc = oldService[2] as string | null;
      const oldPrice = oldService[3] as number;
      addAuditLog("services", id, "name", oldName, name.trim(), `user:${session.userId}`);
      addAuditLog(
        "services",
        id,
        "description",
        oldDesc,
        description?.trim() || "",
        `user:${session.userId}`,
      );
      addAuditLog(
        "services",
        id,
        "price",
        String(oldPrice),
        String(price),
        `user:${session.userId}`,
      );

      return { success: true, changes: result.changes };
    },
  );

  ipcMain.handle("services:delete", async (_event, sessionId: string, id: number) => {
    const session = requireAuth(sessionId, ["owner", "manager"]);
    if (!session) return { success: false, error: "Unauthorized" };

    const oldService = runOne("SELECT * FROM services WHERE id = ?", [id] as BindParams);
    if (!oldService) {
      return { success: false, error: "Service not found" };
    }

    const result = runSql("UPDATE services SET is_deleted = 1 WHERE id = ?", [id] as BindParams);

    addAuditLog("services", id, "is_deleted", "0", "1", `user:${session.userId}`);
    logSystemEvent("service_deleted", `Service deleted: ${oldService[1] as string}`, 1);

    return { success: true, changes: result.changes };
  });
}
