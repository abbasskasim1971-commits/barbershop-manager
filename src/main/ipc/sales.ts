import { ipcMain } from "electron";
import {
  requireAuth,
  getUtcNow,
  runOne,
  runSql,
  runQuery,
  beginTransaction,
  commitTransaction,
  rollbackTransaction,
  addAuditLog,
  logSystemEvent,
  mapSales,
  rowToCommissionRate,
  calendarDateToUtcRange,
} from "../database";
import type { BindParams, SqlValue } from "sql.js";

export function registerSalesHandlers(): void {
  ipcMain.handle("sales:getById", async (_event, sessionId: string, id: number) => {
    const session = requireAuth(sessionId, ["owner", "manager"]);
    if (!session) return undefined;
    const row = runOne("SELECT * FROM sales WHERE id = ? AND is_deleted = 0", [id] as BindParams);
    if (!row) return undefined;
    return {
      id: row[0] as number,
      saleUuid: (row[8] as string) || "",
      barberId: row[1] as number,
      stationId: row[2] as number,
      totalAmount: row[3] as number,
      cashAmount: row[4] as number,
      isDeleted: row[5] === 1,
      createdAt: row[6] as string,
      createdBy: row[7] as number,
    };
  });

  ipcMain.handle("sales:getLines", async (_event, sessionId: string, saleId: number) => {
    const session = requireAuth(sessionId, ["owner", "manager"]);
    if (!session) return { serviceLines: [], productLines: [] };
    const serviceLines = runQuery(
      "SELECT id, service_id, name, price, quantity, line_total FROM sale_service_lines WHERE sale_id = ?",
      [saleId] as BindParams,
    );
    const productLines = runQuery(
      "SELECT id, product_id, name, price, cost_price, quantity, line_total FROM sale_product_lines WHERE sale_id = ?",
      [saleId] as BindParams,
    );
    return {
      serviceLines: serviceLines.map((r) => ({
        id: r[0] as number,
        itemId: r[1] as number,
        name: r[2] as string,
        price: r[3] as number,
        quantity: r[4] as number,
        lineTotal: r[5] as number,
      })),
      productLines: productLines.map((r) => ({
        id: r[0] as number,
        itemId: r[1] as number,
        name: r[2] as string,
        price: r[3] as number,
        costPrice: r[4] as number,
        quantity: r[5] as number,
        lineTotal: r[6] as number,
      })),
    };
  });

  ipcMain.handle("sales:getAll", async (_event, sessionId: string, limit = 100, offset = 0) => {
    const session = requireAuth(sessionId, ["owner", "manager"]);
    if (!session) return [];
    return mapSales(
      runQuery(
        "SELECT * FROM sales WHERE is_deleted = 0 ORDER BY created_at DESC LIMIT ? OFFSET ?",
        [limit, offset] as BindParams,
      ),
    );
  });

  ipcMain.handle(
    "sales:getForBarber",
    async (_event, sessionId: string, barberId: number, date: string) => {
      const session = requireAuth(sessionId, ["owner", "manager"]);
      if (!session) return [];
      const { start, end } = calendarDateToUtcRange(date);
      return mapSales(
        runQuery(
          "SELECT * FROM sales WHERE barber_id = ? AND created_at >= ? AND created_at < ? AND is_deleted = 0",
          [barberId, start, end] as BindParams,
        ),
      );
    },
  );

  ipcMain.handle(
    "sales:create",
    async (
      _event,
      sessionId: string,
      barberId: number,
      lines: Array<{ type: "service" | "product"; itemId: number; name: string; quantity: number }>,
    ) => {
      const session = requireAuth(sessionId, ["owner", "manager", "barber"]);
      if (!session) return { success: false, error: "Unauthorized" };

      const isBarber = session.role === "barber";

      // Barber identity is server-authoritative: a barber may ONLY create sales on
      // their own behalf. The session identity always wins over the client-passed barberId.
      const effectiveBarberId = isBarber ? session.userId : barberId;
      if (isBarber) {
        if (lines.length === 0) {
          return { success: false, error: "A sale must have at least one line" };
        }
        for (const line of lines) {
          if (line.type !== "service") {
            return { success: false, error: "Barbers may only sell services" };
          }
        }
      }

      // Station identity is device-authoritative: a sale always originates at the
      // authenticated device's bound station, never from a renderer-supplied value.
      const stationId = session.stationId;
      const saleUuid = `sale_${crypto.randomUUID()}`;
      const now = getUtcNow();
      try {
        beginTransaction();

        let totalAmount = 0;
        const lineOps: Array<{ sql: string; params: SqlValue[] }> = [];

        for (const line of lines) {
          if (line.quantity <= 0) {
            throw new Error(`Quantity must be greater than zero for: ${line.name}`);
          }

          if (line.type === "service") {
            const service = runOne("SELECT price FROM services WHERE id = ? AND is_deleted = 0", [
              line.itemId,
            ] as BindParams);
            if (!service) {
              throw new Error(`Service not found: ${line.name}`);
            }
            const price = service[0] as number;
            const quantity = line.quantity;
            const lineTotal = price * quantity;
            totalAmount += lineTotal;
            lineOps.push({
              sql: "INSERT INTO sale_service_lines (sale_id, service_id, name, price, quantity, line_total) VALUES (?, ?, ?, ?, ?, ?)",
              params: [null, line.itemId, line.name, price, quantity, lineTotal],
            });
          } else {
            const product = runOne(
              "SELECT price, cost_price, quantity FROM products WHERE id = ? AND is_deleted = 0",
              [line.itemId] as BindParams,
            );
            if (!product) {
              throw new Error(`Product not found: ${line.name}`);
            }
            const price = product[0] as number;
            const costPrice = product[1] as number;
            const currentStock = product[2] as number;
            const qty = line.quantity;
            if (currentStock < qty) {
              throw new Error(
                `Insufficient stock for: ${line.name} (have ${currentStock}, need ${qty})`,
              );
            }
            const lineTotal = price * qty;
            totalAmount += lineTotal;

            const newStock = currentStock - qty;
            runSql("UPDATE products SET quantity = ?, updated_at = ? WHERE id = ?", [
              newStock,
              now,
              line.itemId,
            ] as BindParams);

            addAuditLog(
              "products",
              line.itemId,
              "quantity",
              String(currentStock),
              String(newStock),
              `user:${session.userId}`,
            );

            lineOps.push({
              sql: "INSERT INTO sale_product_lines (sale_id, product_id, name, price, cost_price, quantity, line_total) VALUES (?, ?, ?, ?, ?, ?, ?)",
              params: [null, line.itemId, line.name, price, costPrice, qty, lineTotal],
            });
          }
        }

        const result = runSql(
          "INSERT INTO sales (barber_id, station_id, total_amount, cash_amount, is_deleted, created_at, created_by, sale_uuid) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [
            effectiveBarberId,
            stationId,
            totalAmount,
            totalAmount,
            0,
            now,
            session.userId,
            saleUuid,
          ] as BindParams,
        );
        const saleId = result.lastInsertRowid;

        for (const op of lineOps) {
          const fixedParams = [saleId, ...op.params.slice(1)] as BindParams;
          runSql(op.sql, fixedParams);
        }

        commitTransaction();

        addAuditLog(
          "sales",
          saleId,
          "total_amount",
          "0",
          String(totalAmount),
          `user:${session.userId}`,
        );
        logSystemEvent(
          "sale_created",
          `Sale created: ${saleId} (uuid: ${saleUuid}, total: ${totalAmount})`,
          stationId,
        );

        return { success: true, id: saleId, totalAmount };
      } catch (error: unknown) {
        rollbackTransaction();
        const message = error instanceof Error ? error.message : "Sale creation failed";
        return { success: false, error: message };
      }
    },
  );

  ipcMain.handle("sales:correct", async (_event, sessionId: string, saleId: number) => {
    const session = requireAuth(sessionId, ["owner", "manager"]);
    if (!session) return { success: false, error: "Unauthorized" };

    const sale = runOne("SELECT * FROM sales WHERE id = ?", [saleId] as BindParams);
    if (!sale || sale[5] === 1) {
      return { success: false, error: "Sale not found or already corrected" };
    }

    const now = getUtcNow();
    const stationId = sale[2] as number;
    try {
      beginTransaction();

      const productLines = runQuery(
        "SELECT product_id, quantity FROM sale_product_lines WHERE sale_id = ?",
        [saleId] as BindParams,
      );

      for (const line of productLines) {
        const productId = line[0] as number;
        const quantity = line[1] as number;
        const productRow = runOne("SELECT quantity FROM products WHERE id = ?", [
          productId,
        ] as BindParams);
        if (!productRow) {
          throw new Error(`Product ${productId} not found during sale correction`);
        }
        const currentStock = productRow[0] as number;
        runSql("UPDATE products SET quantity = ?, updated_at = ? WHERE id = ?", [
          currentStock + quantity,
          now,
          productId,
        ] as BindParams);
        addAuditLog(
          "products",
          productId,
          "quantity",
          String(currentStock),
          String(currentStock + quantity),
          `user:${session.userId}`,
        );
      }

      runSql("UPDATE sales SET is_deleted = 1 WHERE id = ?", [saleId] as BindParams);

      commitTransaction();

      addAuditLog("sales", saleId, "is_deleted", "0", "1", `user:${session.userId}`);
      logSystemEvent("sale_corrected", `Sale corrected: ${saleId}`, stationId || 1);

      return { success: true };
    } catch (error: unknown) {
      rollbackTransaction();
      const message = error instanceof Error ? error.message : "Sale correction failed";
      return { success: false, error: message };
    }
  });

  ipcMain.handle("commission:getRate", async (_event, sessionId: string, barberId: number) => {
    const session = requireAuth(sessionId, ["owner", "manager"]);
    if (!session) return null;
    const rows = runQuery(
      "SELECT * FROM commission_rates WHERE barber_id = ? AND is_deleted = 0 ORDER BY effective_from DESC LIMIT 1",
      [barberId] as BindParams,
    );
    return rows[0] ? rowToCommissionRate(rows[0]) : null;
  });

  ipcMain.handle(
    "commission:getDues",
    async (_event, sessionId: string, barberId: number, startDate: string, endDate: string) => {
      const session = requireAuth(sessionId, ["owner"]);
      if (!session) return 0;
      const { start } = calendarDateToUtcRange(startDate);
      const { end } = calendarDateToUtcRange(endDate);
      const rows = runQuery(
        `SELECT sl.line_total, cr.rate
       FROM sales s
       JOIN sale_service_lines sl ON s.id = sl.sale_id
       JOIN commission_rates cr ON cr.barber_id = s.barber_id
       WHERE s.barber_id = ? AND s.created_at >= ? AND s.created_at < ? AND s.is_deleted = 0
         AND cr.effective_from = (
           SELECT MAX(cr2.effective_from)
           FROM commission_rates cr2
           WHERE cr2.barber_id = s.barber_id
             AND cr2.is_deleted = 0
             AND cr2.effective_from <= s.created_at
         )`,
        [barberId, start, end] as BindParams,
      );
      let totalCommission = 0;
      for (const row of rows) {
        const lineTotal = row[0] as number;
        const rate = (row[1] as number) || 0;
        totalCommission += Math.round((lineTotal * rate) / 100);
      }
      return totalCommission;
    },
  );

  ipcMain.handle(
    "commission:setRate",
    async (_event, sessionId: string, barberId: number, rate: number) => {
      const session = requireAuth(sessionId, ["owner"]);
      if (!session) return { success: false, error: "Unauthorized" };
      if (rate < 0) {
        return { success: false, error: "Rate cannot be negative" };
      }
      const now = getUtcNow();
      runSql(
        "INSERT INTO commission_rates (barber_id, rate, effective_from, is_deleted, created_at) VALUES (?, ?, ?, ?, ?)",
        [barberId, rate, now, 0, now] as BindParams,
      );
      return { success: true };
    },
  );

  ipcMain.handle("users:getActiveBarbers", async (_event, sessionId: string) => {
    const session = requireAuth(sessionId, ["owner", "manager"]);
    if (!session) return [];
    const rows = runQuery(
      "SELECT id, username FROM users WHERE role = 'barber' AND is_active = 1 ORDER BY username",
      [] as BindParams,
    );
    return rows.map((r) => ({ id: r[0] as number, username: r[1] as string }));
  });
}
