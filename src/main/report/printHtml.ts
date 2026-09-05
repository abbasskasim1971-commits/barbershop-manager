import { getUtcNow, toBaghdadDate } from "../database";
import type {
  BarberComparisonPayload,
  BarberDuesPayload,
  ProfitLossPayload,
  ReportPayload,
  SalesReportPayload,
} from "./types";

function money(n: number): string {
  return `${n.toLocaleString("en-US")} IQD`;
}

function quantity(n: number): string {
  return n.toLocaleString("en-US");
}

interface Section<T> {
  caption: string;
  headers: string[];
  alignment: ("num" | "text")[];
  rows: T[];
}

function renderTable<T>(
  section: Section<T>,
  valueFor: (row: T, index: number) => string[],
): string {
  const body = section.rows
    .map((row) => {
      const cells = valueFor(row, 0)
        .map((cell, index) => `<td class="${section.alignment[index] || "text"}">${cell}</td>`)
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");
  const header = section.headers
    .map((h, index) => `<th class="${section.alignment[index] || "text"}">${h}</th>`)
    .join("");
  return `
    <h2 class="section-title">${section.caption}</h2>
    <table>
      <thead><tr>${header}</tr></thead>
      <tbody>${body}</tbody>
    </table>`;
}

function renderFinancialLines(
  title: string,
  lines: Array<{ label: string; value: string; strong?: boolean }>,
): string {
  const rows = lines
    .map(
      (line) =>
        `<tr class="${line.strong ? "strong" : ""}">
          <td>${line.label}</td>
          <td class="num">${line.value}</td>
        </tr>`,
    )
    .join("");
  return `
    <h2 class="section-title">${title}</h2>
    <table>
      <tbody>${rows}</tbody>
    </table>`;
}

function buildOf(sales: SalesReportPayload): string {
  const summary = [
    { label: "عدد المبيعات", value: quantity(sales.salesCount) },
    { label: "إيراد الخدمات", value: money(sales.serviceRevenue) },
    { label: "إيراد المنتجات", value: money(sales.productRevenue) },
    { label: "إجمالي الإيراد", value: money(sales.totalRevenue), strong: true },
    { label: "كلفة المبيعات (المنتجات)", value: money(sales.cogs) },
    { label: "إجمالي الأرباح", value: money(sales.totalRevenue - sales.cogs), strong: true },
  ];
  const summaryHtml = renderFinancialLines("ملخص المبيعات", summary);

  const byService = renderTable<{ name: string; quantity: number; revenue: number }>(
    {
      caption: "تحليل بالخدمات",
      headers: ["الخدمة", "العدد", "الإيراد"],
      alignment: ["text", "num", "num"],
      rows: sales.byService,
    },
    (row) => [row.name, quantity(row.quantity), money(row.revenue)],
  );

  const byProduct = renderTable<{
    name: string;
    quantity: number;
    revenue: number;
    cost: number;
    grossProfit: number;
  }>(
    {
      caption: "تحليل بالمنتجات",
      headers: ["المنتج", "الكمية", "الإيراد", "الكلفة", "الربح"],
      alignment: ["text", "num", "num", "num", "num"],
      rows: sales.byProduct,
    },
    (row) => [
      row.name,
      quantity(row.quantity),
      money(row.revenue),
      money(row.cost),
      money(row.grossProfit),
    ],
  );

  return summaryHtml + byService + byProduct;
}

function buildOfBarberDues(dues: BarberDuesPayload): string {
  const table = renderTable(
    {
      caption: "تفاصيل الحلاقين",
      headers: ["الحلاق", "المبيعات", "الأعمال", "إيراد الخدمات", "العمولة"],
      alignment: ["text", "num", "num", "num", "num"],
      rows: dues.rows,
    },
    (row) => [
      row.username,
      quantity(row.salesCount),
      quantity(row.jobs),
      money(row.serviceRevenue),
      money(row.commission),
    ],
  );
  const totals = renderFinancialLines("الإجماليات", [
    { label: "عدد المبيعات", value: quantity(dues.totals.salesCount) },
    { label: "أعمال الحلاقين", value: quantity(dues.totals.jobs) },
    { label: "إيراد الخدمات", value: money(dues.totals.serviceRevenue) },
    { label: "عمولات الحلاقين", value: money(dues.totals.commission), strong: true },
  ]);
  return totals + table;
}

function buildOfBarberComparison(comparison: BarberComparisonPayload): string {
  return renderTable(
    {
      caption: "الترتيب حسب إيراد الخدمات",
      headers: ["المرتبة", "الحلاق", "المبيعات", "الأعمال", "إيراد الخدمات", "العمولة"],
      alignment: ["text", "text", "num", "num", "num", "num"],
      rows: comparison.rows,
    },
    (row) => [
      String(row.rank),
      row.username,
      quantity(row.salesCount),
      quantity(row.jobs),
      money(row.serviceRevenue),
      money(row.commission),
    ],
  );
}

function buildOfProfitLoss(pl: ProfitLossPayload): string {
  return renderFinancialLines("بيان الأرباح والخسائر", [
    { label: "إيراد الخدمات", value: money(pl.serviceRevenue) },
    { label: "إيراد المنتجات", value: money(pl.productRevenue) },
    { label: "إجمالي الإيراد", value: money(pl.salesRevenue), strong: true },
    { label: "كلفة المبيعات (كلفة المنتجات التاريخية)", value: money(pl.cogs) },
    { label: "إجمالي الربح", value: money(pl.grossProfit), strong: true },
    { label: "عمولات الحلاقين (خدمات فقط)", value: money(pl.barberCommissions) },
    { label: "المصاريف التشغيلية", value: money(pl.operatingExpenses) },
    { label: "صافي ربح المحل", value: money(pl.netShopProfit), strong: true },
    {
      label: "السحوبات الشخصية للمالك (لا تدخل في صافي الربح)",
      value: money(pl.ownerWithdrawals),
    },
  ]);
}

const TITLES: Record<string, string> = {
  sales: "تقرير المبيعات",
  barberDues: "أعمال الحلاقين والمستحقات",
  barberComparison: "مقارنة أداء الحلاقين",
  profitLoss: "بيان الأرباح والخسائر",
};

function buildSections(payload: ReportPayload): string {
  switch (payload.reportName) {
    case "sales":
      return buildOf(payload);
    case "barberDues":
      return buildOfBarberDues(payload);
    case "barberComparison":
      return buildOfBarberComparison(payload);
    case "profitLoss":
      return buildOfProfitLoss(payload);
  }
}

export function buildA4Html(payload: ReportPayload): string {
  const title = TITLES[payload.reportName];
  const period = `${payload.startDate} إلى ${payload.endDate}`;
  const generated = `تاريخ الإصدار: ${toBaghdadDate(getUtcNow())}`;
  let filter = "";
  if (payload.reportName === "sales" && payload.barberName) {
    filter = ` | الحلاق: ${payload.barberName}`;
  }
  const sections = buildSections(payload);

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<title>${title}</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Tahoma, Arial, sans-serif; direction: rtl; color: #1a1a2e; margin: 0; padding: 0; }
  h1 { margin: 0 0 2px 0; font-size: 20px; }
  .meta { margin: 0 0 16px 0; color: #555; font-size: 12px; }
  .section-title { font-size: 14px; margin: 18px 0 6px 0; color: #1a1a2e; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  th, td { border: 1px solid #999; padding: 5px 8px; font-size: 13px; }
  th { background: #eeeeee; }
  td.num, th.num { text-align: left; }
  td.text, th.text { text-align: right; }
  tr.strong td { font-weight: bold; background: #f7f7f7; }
  .footer { margin-top: 24px; font-size: 11px; color: #888; text-align: center; }
</style>
</head>
<body>
  <h1>${title}</h1>
  <div class="meta">الفترة: ${period}${filter}<br />${generated}</div>
  ${sections}
  <div class="footer">تقرير محلي صادر من برنامج إدارة الحلاقة</div>
</body>
</html>`;
}
