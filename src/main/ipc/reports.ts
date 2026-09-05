import { ipcMain, BrowserWindow, dialog } from "electron";
import * as fs from "fs";
import {
  requireAuth,
  getUtcNow,
  runQuery,
  runOne,
  calendarDateToUtcRange,
  toBaghdadDate,
} from "../database";
import { buildA4Html } from "../report/printHtml";
import { buildExcelBuffer } from "../report/excelExport";
import type {
  BarberRow,
  ReportPayload,
  ReportName,
  ProfitLossPayload,
  SalesReportPayload,
} from "../report/types";
import type { BindParams } from "sql.js";

const BUSINESS_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type PresetName = "daily" | "weekly" | "monthly";

function isRealDate(dateStr: string): boolean {
  const [year, month, day] = dateStr.split("-").map(Number);
  const check = new Date(Date.UTC(year, month - 1, day));
  return (
    check.getUTCFullYear() === year &&
    check.getUTCMonth() === month - 1 &&
    check.getUTCDate() === day
  );
}

function toDateString(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return toDateString(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

function validRange(startDate: string, endDate: string): { start: string; end: string } | null {
  if (
    !BUSINESS_DATE_RE.test(startDate) ||
    !BUSINESS_DATE_RE.test(endDate) ||
    !isRealDate(startDate) ||
    !isRealDate(endDate) ||
    startDate > endDate
  ) {
    return null;
  }
  const { start } = calendarDateToUtcRange(startDate);
  const { end } = calendarDateToUtcRange(endDate);
  return { start, end };
}

function computePresetRange(preset: PresetName, dateStr: string): { start: string; end: string } {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (preset === "daily") {
    return { start: dateStr, end: dateStr };
  }
  if (preset === "monthly") {
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return { start: toDateString(y, m, 1), end: toDateString(y, m, lastDay) };
  }
  // weekly: Monday to Sunday
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  const offsetToMonday = (dow + 6) % 7;
  const monday = addDays(dateStr, -offsetToMonday);
  return { start: monday, end: addDays(monday, 6) };
}

function isPositiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function getUserName(userId: number): string {
  const row = runOne("SELECT username FROM users WHERE id = ?", [userId] as BindParams);
  return row ? (row[0] as string) : "";
}

// ── Commission (service-only, effective-dated rates) ─────────────────────
function commissionForRange(
  start: string,
  end: string,
  barberId: number | null,
): Map<number, { commission: number; lineTotal: number }> {
  const sql = `
    SELECT s.barber_id, sl.line_total, cr.rate
    FROM sales s
    JOIN sale_service_lines sl ON sl.sale_id = s.id
    LEFT JOIN commission_rates cr
      ON cr.barber_id = s.barber_id
     AND cr.is_deleted = 0
     AND cr.effective_from = (
       SELECT MAX(cr2.effective_from)
       FROM commission_rates cr2
       WHERE cr2.barber_id = s.barber_id
         AND cr2.is_deleted = 0
         AND cr2.effective_from <= s.created_at
     )
    WHERE s.is_deleted = 0 AND s.created_at >= ? AND s.created_at < ?
    ${barberId ? "AND s.barber_id = ?" : ""}
  `;
  const params: BindParams = barberId ? [start, end, barberId] : [start, end];
  const rows = runQuery(sql, params);
  const totals = new Map<number, { commission: number; lineTotal: number }>();
  for (const row of rows) {
    const bid = row[0] as number;
    const lineTotal = row[1] as number;
    const rate = (row[2] as number) || 0;
    const current = totals.get(bid) || { commission: 0, lineTotal: 0 };
    current.lineTotal += lineTotal;
    current.commission += Math.round((lineTotal * rate) / 100);
    totals.set(bid, current);
  }
  return totals;
}

function computeSalesReport(
  start: string,
  end: string,
  barberId: number | null,
  startDate: string,
  endDate: string,
): SalesReportPayload {
  const barberClause = barberId ? "AND s.barber_id = ?" : "";
  const saleParams: BindParams = barberId ? [start, end, barberId] : [start, end];

  const salesCountRow = runOne(
    `SELECT COUNT(*) FROM sales s WHERE s.is_deleted = 0 AND s.created_at >= ? AND s.created_at < ? ${barberClause}`,
    saleParams,
  );
  const salesCount = salesCountRow ? (salesCountRow[0] as number) : 0;

  const serviceCalc = `SELECT sl.name AS name,
            SUM(sl.quantity) AS quantity,
            SUM(sl.line_total) AS revenue
     FROM sale_service_lines sl
     JOIN sales s ON s.id = sl.sale_id
     WHERE s.is_deleted = 0 AND s.created_at >= ? AND s.created_at < ? ${barberClause}
     GROUP BY sl.service_id, sl.name
     ORDER BY revenue DESC, sl.name`;
  const serviceRows = runQuery(serviceCalc, saleParams);
  const byService = serviceRows.map((r) => ({
    name: r[0] as string,
    quantity: r[1] as number,
    revenue: r[2] as number,
  }));
  const serviceRevenue = byService.reduce((sum, row) => sum + row.revenue, 0);
  const serviceJobsCount = byService.reduce((sum, row) => sum + row.quantity, 0);

  const productCalc = `SELECT sl.product_id AS product_id, sl.name AS name,
            SUM(sl.quantity) AS quantity,
            SUM(sl.line_total) AS revenue,
            SUM(sl.cost_price * sl.quantity) AS cost
     FROM sale_product_lines sl
     JOIN sales s ON s.id = sl.sale_id
     WHERE s.is_deleted = 0 AND s.created_at >= ? AND s.created_at < ? ${barberClause}
     GROUP BY sl.product_id, sl.name
     ORDER BY revenue DESC, sl.name`;
  const productRows = runQuery(productCalc, saleParams);
  const byProduct = productRows.map((r) => ({
    productId: r[0] as number,
    name: r[1] as string,
    quantity: r[2] as number,
    revenue: r[3] as number,
    cost: r[4] as number,
    grossProfit: (r[3] as number) - (r[4] as number),
  }));
  const productRevenue = byProduct.reduce((sum, row) => sum + row.revenue, 0);
  const productItemsCount = byProduct.reduce((sum, row) => sum + row.quantity, 0);
  const cogs = byProduct.reduce((sum, row) => sum + row.cost, 0);

  return {
    reportName: "sales",
    startDate,
    endDate,
    barberId,
    barberName: barberId ? getUserName(barberId) : null,
    salesCount,
    serviceJobsCount,
    productItemsCount,
    serviceRevenue,
    productRevenue,
    totalRevenue: serviceRevenue + productRevenue,
    cogs,
    byService,
    byProduct,
  };
}

function computeBarberDues(
  start: string,
  end: string,
): {
  rows: BarberRow[];
  totals: { salesCount: number; jobs: number; serviceRevenue: number; commission: number };
} {
  const rows = runQuery(
    `SELECT u.id AS barber_id, u.username AS username,
            COUNT(DISTINCT s.id) AS sales_count,
            COUNT(sl.id) AS jobs,
            COALESCE(SUM(sl.line_total), 0) AS service_revenue
     FROM users u
     LEFT JOIN sales s ON s.barber_id = u.id AND s.is_deleted = 0
       AND s.created_at >= ? AND s.created_at < ?
     LEFT JOIN sale_service_lines sl ON sl.sale_id = s.id
     WHERE u.role = 'barber'
     GROUP BY u.id, u.username
     ORDER BY service_revenue DESC, u.username`,
    [start, end] as BindParams,
  );
  const commissionTotals = commissionForRange(start, end, null);
  const barberRows: BarberRow[] = rows.map((r) => {
    const barberId = r[0] as number;
    const comm = commissionTotals.get(barberId)?.commission || 0;
    return {
      barberId,
      username: r[1] as string,
      salesCount: r[2] as number,
      jobs: r[3] as number,
      serviceRevenue: r[4] as number,
      commission: comm,
    };
  });
  const totals = barberRows.reduce(
    (acc, row) => ({
      salesCount: acc.salesCount + row.salesCount,
      jobs: acc.jobs + row.jobs,
      serviceRevenue: acc.serviceRevenue + row.serviceRevenue,
      commission: acc.commission + row.commission,
    }),
    { salesCount: 0, jobs: 0, serviceRevenue: 0, commission: 0 },
  );
  return { rows: barberRows, totals };
}

function computeProfitLoss(
  start: string,
  end: string,
  startDate: string,
  endDate: string,
): ProfitLossPayload {
  const sales = computeSalesReport(start, end, null, startDate, endDate);
  const serviceRevenue = sales.serviceRevenue;
  const productRevenue = sales.productRevenue;
  const salesRevenue = serviceRevenue + productRevenue;
  const cogs = sales.cogs;
  const grossProfit = salesRevenue - cogs;

  const commissionTotals = commissionForRange(start, end, null);
  let barberCommissions = 0;
  for (const value of commissionTotals.values()) {
    barberCommissions += value.commission;
  }

  const expenseRow = runOne(
    "SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE is_deleted = 0 AND created_at >= ? AND created_at < ?",
    [start, end] as BindParams,
  );
  const operatingExpenses = expenseRow ? (expenseRow[0] as number) : 0;

  const netShopProfit = grossProfit - barberCommissions - operatingExpenses;

  return {
    reportName: "profitLoss",
    startDate,
    endDate,
    salesCount: sales.salesCount,
    serviceJobsCount: sales.serviceJobsCount,
    serviceRevenue,
    productRevenue,
    salesRevenue,
    cogs,
    grossProfit,
    barberCommissions,
    operatingExpenses,
    netShopProfit,
    ownerWithdrawals: 0,
  };
}

function computeReport(
  report: ReportName,
  startDate: string,
  endDate: string,
  barberId?: unknown,
): ReportPayload | null {
  const range = validRange(startDate, endDate);
  if (!range) return null;
  const safeBarberId = isPositiveInt(barberId) && report === "sales" ? barberId : null;

  switch (report) {
    case "sales":
      return computeSalesReport(range.start, range.end, safeBarberId, startDate, endDate);
    case "barberDues": {
      const { rows, totals } = computeBarberDues(range.start, range.end);
      return { reportName: "barberDues", startDate, endDate, rows, totals };
    }
    case "barberComparison": {
      const { rows } = computeBarberDues(range.start, range.end);
      return {
        reportName: "barberComparison",
        startDate,
        endDate,
        rows: rows.map((row, index) => ({ ...row, rank: index + 1 })),
      };
    }
    case "profitLoss":
      return computeProfitLoss(range.start, range.end, startDate, endDate);
    default:
      return null;
  }
}

function printHtml(html: string): Promise<boolean> {
  return new Promise((resolve) => {
    const win = new BrowserWindow({
      show: false,
      title: "Print Report",
      webPreferences: { sandbox: true },
    });
    win.webContents.once("did-finish-load", () => {
      void win.webContents.print({ silent: false, printBackground: true }, (success: boolean) => {
        win.destroy();
        resolve(success);
      });
    });
    win.webContents.once("did-fail-load", () => {
      win.destroy();
      resolve(false);
    });
    void win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
  });
}

export function registerReportHandlers(): void {
  ipcMain.handle(
    "reports:getPresetRange",
    async (_event, sessionId: string, preset: PresetName, date?: string) => {
      const session = requireAuth(sessionId, ["owner"]);
      if (!session) return null;
      if (preset !== "daily" && preset !== "weekly" && preset !== "monthly") return null;
      const baseDate =
        date && BUSINESS_DATE_RE.test(date) && isRealDate(date) ? date : toBaghdadDate(getUtcNow());
      return computePresetRange(preset, baseDate);
    },
  );

  ipcMain.handle(
    "reports:get",
    async (
      _event,
      sessionId: string,
      report: ReportName,
      startDate: string,
      endDate: string,
      barberId?: unknown,
    ) => {
      const session = requireAuth(sessionId, ["owner"]);
      if (!session) return null;
      return computeReport(report, startDate, endDate, barberId);
    },
  );

  ipcMain.handle(
    "reports:getPrintHtml",
    async (
      _event,
      sessionId: string,
      report: ReportName,
      startDate: string,
      endDate: string,
      barberId?: unknown,
    ) => {
      const session = requireAuth(sessionId, ["owner"]);
      if (!session) return null;
      const payload = computeReport(report, startDate, endDate, barberId);
      if (!payload) return null;
      return buildA4Html(payload);
    },
  );

  ipcMain.handle(
    "reports:print",
    async (
      _event,
      sessionId: string,
      report: ReportName,
      startDate: string,
      endDate: string,
      barberId?: unknown,
    ) => {
      const session = requireAuth(sessionId, ["owner"]);
      if (!session) return { success: false, error: "Unauthorized" };
      const payload = computeReport(report, startDate, endDate, barberId);
      if (!payload) return { success: false, error: "Invalid report period" };
      const ok = await printHtml(buildA4Html(payload));
      return ok ? { success: true } : { success: false, error: "Print failed" };
    },
  );

  ipcMain.handle(
    "reports:getExcelBase64",
    async (
      _event,
      sessionId: string,
      report: ReportName,
      startDate: string,
      endDate: string,
      barberId?: unknown,
    ) => {
      const session = requireAuth(sessionId, ["owner"]);
      if (!session) return null;
      const payload = computeReport(report, startDate, endDate, barberId);
      if (!payload) return null;
      return { success: true, base64: (await buildExcelBuffer(payload)).toString("base64") };
    },
  );

  ipcMain.handle(
    "reports:exportExcel",
    async (
      _event,
      sessionId: string,
      report: ReportName,
      startDate: string,
      endDate: string,
      barberId?: unknown,
    ) => {
      const session = requireAuth(sessionId, ["owner"]);
      if (!session) return { success: false, error: "Unauthorized" };
      const payload = computeReport(report, startDate, endDate, barberId);
      if (!payload) return { success: false, error: "Invalid report period" };

      const defaultName = `${report}-${payload.startDate}_${payload.endDate}.xlsx`;
      const result = await dialog.showSaveDialog({
        title: "Export Excel",
        defaultPath: defaultName,
        filters: [{ name: "Excel Workbook", extensions: ["xlsx"] }],
      });
      if (result.canceled || !result.filePath) {
        return { success: false, canceled: true };
      }
      try {
        fs.writeFileSync(result.filePath, await buildExcelBuffer(payload));
        return { success: true, path: result.filePath };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Export failed";
        return { success: false, error: message };
      }
    },
  );
}
