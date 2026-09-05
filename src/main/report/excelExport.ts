import ExcelJS from "exceljs";
import type {
  BarberComparisonPayload,
  BarberDuesPayload,
  ProfitLossPayload,
  ReportPayload,
  SalesReportPayload,
} from "./types";

type Workbook = ExcelJS.Workbook;
type Worksheet = ExcelJS.Worksheet;

function applySheetSetup(ws: Worksheet): void {
  ws.views = [{ rightToLeft: true }];
  ws.getRow(1).font = { bold: true };
}

function buildSales(wb: Workbook, def: SalesReportPayload): void {
  const summary = wb.addWorksheet("المبيعات");
  applySheetSetup(summary);
  summary.columns = [
    { header: "المعرف", key: "label", width: 34 },
    { header: "القيمة", key: "value", width: 18 },
  ];
  summary.addRows([
    ["عدد المبيعات", def.salesCount],
    ["إيراد الخدمات", def.serviceRevenue],
    ["إيراد المنتجات", def.productRevenue],
    ["إجمالي الإيراد", def.totalRevenue],
    ["كلفة المبيعات (المنتجات)", def.cogs],
    ["إجمالي الأرباح", def.totalRevenue - def.cogs],
  ]);

  const services = wb.addWorksheet("تحليل الخدمات");
  applySheetSetup(services);
  services.columns = [
    { header: "الخدمة", key: "name", width: 30 },
    { header: "العدد", key: "quantity", width: 12 },
    { header: "الإيراد", key: "revenue", width: 16 },
  ];
  services.addRows(def.byService.map((row) => [row.name, row.quantity, row.revenue]));

  const products = wb.addWorksheet("تحليل المنتجات");
  applySheetSetup(products);
  products.columns = [
    { header: "المنتج", key: "name", width: 30 },
    { header: "الكمية", key: "quantity", width: 12 },
    { header: "الإيراد", key: "revenue", width: 16 },
    { header: "الكلفة", key: "cost", width: 16 },
    { header: "الربح", key: "grossProfit", width: 16 },
  ];
  products.addRows(
    def.byProduct.map((row) => [row.name, row.quantity, row.revenue, row.cost, row.grossProfit]),
  );
}

function buildBarberDues(wb: Workbook, def: BarberDuesPayload): void {
  const sheet = wb.addWorksheet("أعمال الحلاقين");
  applySheetSetup(sheet);
  sheet.columns = [
    { header: "الحلاق", key: "username", width: 24 },
    { header: "المبيعات", key: "salesCount", width: 12 },
    { header: "الأعمال", key: "jobs", width: 12 },
    { header: "إيراد الخدمات", key: "serviceRevenue", width: 16 },
    { header: "العمولة", key: "commission", width: 16 },
  ];
  sheet.addRows(
    def.rows.map((row) => [
      row.username,
      row.salesCount,
      row.jobs,
      row.serviceRevenue,
      row.commission,
    ]),
  );
  sheet.addRows([
    [
      "الإجمالي",
      def.totals.salesCount,
      def.totals.jobs,
      def.totals.serviceRevenue,
      def.totals.commission,
    ],
  ]);
}

function buildBarberComparison(wb: Workbook, def: BarberComparisonPayload): void {
  const sheet = wb.addWorksheet("مقارنة الحلاقين");
  applySheetSetup(sheet);
  sheet.columns = [
    { header: "المرتبة", key: "rank", width: 10 },
    { header: "الحلاق", key: "username", width: 24 },
    { header: "المبيعات", key: "salesCount", width: 12 },
    { header: "الأعمال", key: "jobs", width: 12 },
    { header: "إيراد الخدمات", key: "serviceRevenue", width: 16 },
    { header: "العمولة", key: "commission", width: 16 },
  ];
  sheet.addRows(
    def.rows.map((row) => [
      row.rank,
      row.username,
      row.salesCount,
      row.jobs,
      row.serviceRevenue,
      row.commission,
    ]),
  );
}

function buildProfitLoss(wb: Workbook, def: ProfitLossPayload): void {
  const sheet = wb.addWorksheet("بيان الأرباح والخسائر");
  applySheetSetup(sheet);
  sheet.columns = [
    { header: "البند", key: "label", width: 34 },
    { header: "القيمة", key: "value", width: 18 },
  ];
  sheet.addRows([
    ["إيراد الخدمات", def.serviceRevenue],
    ["إيراد المنتجات", def.productRevenue],
    ["إجمالي الإيراد", def.salesRevenue],
    ["كلفة المبيعات (كلفة المنتجات التاريخية)", def.cogs],
    ["إجمالي الربح", def.grossProfit],
    ["عمولات الحلاقين (خدمات فقط)", def.barberCommissions],
    ["المصاريف التشغيلية", def.operatingExpenses],
    ["صافي ربح المحل", def.netShopProfit],
    ["السحوبات الشخصية للمالك (لا تدخل في صافي الربح)", def.ownerWithdrawals],
  ]);
}

export async function buildExcelBuffer(payload: ReportPayload): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  switch (payload.reportName) {
    case "sales":
      buildSales(workbook, payload);
      break;
    case "barberDues":
      buildBarberDues(workbook, payload);
      break;
    case "barberComparison":
      buildBarberComparison(workbook, payload);
      break;
    case "profitLoss":
      buildProfitLoss(workbook, payload);
      break;
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
