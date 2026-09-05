export type ReportName = "sales" | "barberDues" | "barberComparison" | "profitLoss";

export interface ServiceBreakdownRow {
  name: string;
  quantity: number;
  revenue: number;
}

export interface ProductBreakdownRow {
  productId: number;
  name: string;
  quantity: number;
  revenue: number;
  cost: number;
  grossProfit: number;
}

export interface SalesReportPayload {
  reportName: "sales";
  startDate: string;
  endDate: string;
  barberId: number | null;
  barberName: string | null;
  salesCount: number;
  serviceJobsCount: number;
  productItemsCount: number;
  serviceRevenue: number;
  productRevenue: number;
  totalRevenue: number;
  cogs: number;
  byService: ServiceBreakdownRow[];
  byProduct: ProductBreakdownRow[];
}

export interface BarberRow {
  barberId: number;
  username: string;
  salesCount: number;
  jobs: number;
  serviceRevenue: number;
  commission: number;
}

export interface BarberDuesPayload {
  reportName: "barberDues";
  startDate: string;
  endDate: string;
  rows: BarberRow[];
  totals: {
    salesCount: number;
    jobs: number;
    serviceRevenue: number;
    commission: number;
  };
}

export interface BarberComparisonRow extends BarberRow {
  rank: number;
}

export interface BarberComparisonPayload {
  reportName: "barberComparison";
  startDate: string;
  endDate: string;
  rows: BarberComparisonRow[];
}

export interface ProfitLossPayload {
  reportName: "profitLoss";
  startDate: string;
  endDate: string;
  salesCount: number;
  serviceJobsCount: number;
  serviceRevenue: number;
  productRevenue: number;
  salesRevenue: number;
  cogs: number;
  grossProfit: number;
  barberCommissions: number;
  operatingExpenses: number;
  netShopProfit: number;
  ownerWithdrawals: number;
}

export type ReportPayload =
  SalesReportPayload | BarberDuesPayload | BarberComparisonPayload | ProfitLossPayload;
