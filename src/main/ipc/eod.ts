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
  calendarDateToUtcRange,
  toBaghdadDate,
  mapDailyClosings,
} from "../database";
import { createBackup } from "../backup";
import type { BindParams } from "sql.js";

const BUSINESS_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isRealDate(date: string): boolean {
  const [year, month, day] = date.split("-").map(Number);
  const check = new Date(Date.UTC(year, month - 1, day));
  return (
    check.getUTCFullYear() === year &&
    check.getUTCMonth() === month - 1 &&
    check.getUTCDate() === day
  );
}

export function registerEodHandlers(): void {
  ipcMain.handle("eod:getStatus", async (_event, sessionId: string) => {
    const session = requireAuth(sessionId, ["owner", "manager"]);
    if (!session) return null;
    return { today: toBaghdadDate(getUtcNow()) };
  });

  ipcMain.handle(
    "eod:getSummary",
    async (_event, sessionId: string, date: string, stationId = 1) => {
      const session = requireAuth(sessionId, ["owner", "manager"]);
      if (!session) return null;
      if (!BUSINESS_DATE_RE.test(date) || !isRealDate(date)) return null;
      const { start, end } = calendarDateToUtcRange(date);

      const salesRow = runOne(
        "SELECT COUNT(*) AS cnt, COALESCE(SUM(cash_amount), 0) AS total FROM sales WHERE is_deleted = 0 AND created_at >= ? AND created_at < ? AND station_id = ?",
        [start, end, stationId] as BindParams,
      );
      const expenseRow = runOne(
        "SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE is_deleted = 0 AND created_at >= ? AND created_at < ?",
        [start, end] as BindParams,
      );
      const closing = runOne(
        "SELECT * FROM daily_closings WHERE business_date = ? AND station_id = ?",
        [date, stationId] as BindParams,
      );

      return {
        date,
        stationId,
        salesCount: salesRow ? (salesRow[0] as number) : 0,
        salesTotal: salesRow ? (salesRow[1] as number) : 0,
        expenseTotal: expenseRow ? (expenseRow[0] as number) : 0,
        closed: Boolean(closing && closing.length > 0),
        closing: closing ? mapDailyClosings([closing])[0] : null,
      };
    },
  );

  ipcMain.handle(
    "eod:closeDay",
    async (_event, sessionId: string, date: string, countedCash: number, stationId = 1) => {
      const session = requireAuth(sessionId, ["owner", "manager"]);
      if (!session) return { success: false, error: "Unauthorized" };

      if (!BUSINESS_DATE_RE.test(date) || !isRealDate(date)) {
        return { success: false, error: "Invalid business date" };
      }
      if (date > toBaghdadDate(getUtcNow())) {
        return { success: false, error: "Cannot close a future business date" };
      }
      if (!Number.isFinite(countedCash) || countedCash < 0) {
        return { success: false, error: "Counted cash must be zero or a positive amount" };
      }

      const existing = runOne(
        "SELECT id FROM daily_closings WHERE business_date = ? AND station_id = ?",
        [date, stationId] as BindParams,
      );
      if (existing) {
        return { success: false, error: "This day has already been closed" };
      }

      const { start, end } = calendarDateToUtcRange(date);
      const now = getUtcNow();
      try {
        beginTransaction();

        const salesRow = runOne(
          "SELECT COALESCE(SUM(cash_amount), 0) AS total FROM sales WHERE is_deleted = 0 AND created_at >= ? AND created_at < ? AND station_id = ?",
          [start, end, stationId] as BindParams,
        );
        const expenseRow = runOne(
          "SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE is_deleted = 0 AND created_at >= ? AND created_at < ?",
          [start, end] as BindParams,
        );
        const expectedCash = salesRow ? (salesRow[0] as number) : 0;
        const expenseTotal = expenseRow ? (expenseRow[0] as number) : 0;
        const counted = Math.round(countedCash);
        const difference = counted - expectedCash;

        runSql(
          "INSERT INTO daily_closings (business_date, station_id, expected_cash, counted_cash, difference, expense_total, closed_by, closed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [
            date,
            stationId,
            expectedCash,
            counted,
            difference,
            expenseTotal,
            session.userId,
            now,
          ] as BindParams,
        );
        addAuditLog(
          "daily_closings",
          0,
          "closed",
          null,
          `${date} expected=${expectedCash} counted=${counted} diff=${difference}`,
          `user:${session.userId}`,
        );

        commitTransaction();

        logSystemEvent(
          "eod_closed",
          `Day ${date} closed for station ${stationId}: expected ${expectedCash}, counted ${counted}, diff ${difference}`,
          stationId,
        );
        createBackup(stationId, date);

        return {
          success: true,
          closing: {
            businessDate: date,
            stationId,
            expectedCash,
            countedCash: counted,
            difference,
            expenseTotal,
            closedBy: session.userId,
            closedAt: now,
          },
        };
      } catch (error: unknown) {
        rollbackTransaction();
        const message = error instanceof Error ? error.message : "Closing failed";
        return { success: false, error: message };
      }
    },
  );

  ipcMain.handle("eod:getClosings", async (_event, sessionId: string, limit = 100, offset = 0) => {
    const session = requireAuth(sessionId, ["owner", "manager"]);
    if (!session) return [];
    return mapDailyClosings(
      runQuery(
        "SELECT * FROM daily_closings ORDER BY business_date DESC, id DESC LIMIT ? OFFSET ?",
        [limit, offset] as BindParams,
      ),
    );
  });
}
