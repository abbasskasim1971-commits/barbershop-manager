import { contextBridge, ipcRenderer } from "electron";

type UserRole = "owner" | "manager" | "barber";

interface ServiceRecord {
  id: number;
  name: string;
  description: string;
  price: number;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ProductRecord {
  id: number;
  name: string;
  price: number;
  costPrice: number;
  quantity: number;
  lowStockThreshold: number;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CategoryRecord {
  id: number;
  name: string;
  isDeleted: boolean;
  createdAt: string;
}

interface ExpenseRecord {
  id: number;
  category: string;
  amount: number;
  description: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AuditEntry {
  id: number;
  entityType: string;
  entityId: number;
  field: string;
  oldValue: string;
  newValue: string;
  changedBy: string;
  changedAt: string;
}

interface EventRecord {
  id: number;
  eventType: string;
  details: string;
  stationId: number;
  timestamp: string;
}

interface CommissionRateRecord {
  id: number;
  barberId: number;
  rate: number;
  effectiveFrom: string;
  isDeleted: boolean;
  createdAt: string;
}

interface SaleRecord {
  id: number;
  barberId: number;
  stationId: number;
  totalAmount: number;
  cashAmount: number;
  isDeleted: boolean;
  createdAt: string;
  createdBy: number;
}

interface DailyClosingRecord {
  id: number;
  businessDate: string;
  stationId: number;
  expectedCash: number;
  countedCash: number;
  difference: number;
  expenseTotal: number;
  closedBy: number;
  closedAt: string;
}

type ReportName = "sales" | "barberDues" | "barberComparison" | "profitLoss";

interface ServiceBreakdownRow {
  name: string;
  quantity: number;
  revenue: number;
}

interface ProductBreakdownRow {
  productId: number;
  name: string;
  quantity: number;
  revenue: number;
  cost: number;
  grossProfit: number;
}

interface SalesReportPayload {
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

interface BarberRow {
  barberId: number;
  username: string;
  salesCount: number;
  jobs: number;
  serviceRevenue: number;
  commission: number;
}

interface BarberDuesPayload {
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

interface BarberComparisonRow extends BarberRow {
  rank: number;
}

interface BarberComparisonPayload {
  reportName: "barberComparison";
  startDate: string;
  endDate: string;
  rows: BarberComparisonRow[];
}

interface ProfitLossPayload {
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

type ReportPayload =
  SalesReportPayload | BarberDuesPayload | BarberComparisonPayload | ProfitLossPayload;

interface DbApi {
  getDbPath: () => Promise<string>;

  // Service methods
  getAllServices: (
    sessionId: string,
    limit?: number,
    offset?: number,
    includeDeleted?: boolean,
  ) => Promise<ServiceRecord[]>;
  getServiceById: (sessionId: string, id: number) => Promise<ServiceRecord | undefined>;
  createService: (
    sessionId: string,
    name: string,
    description: string,
    price: number,
  ) => Promise<{ success: boolean; error?: string; id?: number }>;
  updateService: (
    sessionId: string,
    id: number,
    name: string,
    description: string,
    price: number,
  ) => Promise<{ success: boolean; error?: string; changes?: number }>;
  softDeleteService: (
    sessionId: string,
    id: number,
  ) => Promise<{ success: boolean; error?: string; changes?: number }>;
  getActiveServices: (sessionId: string) => Promise<ServiceRecord[]>;

  // Product methods
  getAllProducts: (
    sessionId: string,
    limit?: number,
    offset?: number,
    includeDeleted?: boolean,
  ) => Promise<ProductRecord[]>;
  getLowStockProducts: (sessionId: string) => Promise<ProductRecord[]>;
  getProductById: (sessionId: string, id: number) => Promise<ProductRecord | undefined>;
  createProduct: (
    sessionId: string,
    name: string,
    price: number,
    costPrice: number,
    quantity: number,
    lowStockThreshold: number,
  ) => Promise<{ success: boolean; error?: string; id?: number }>;
  updateProduct: (
    sessionId: string,
    id: number,
    name: string,
    price: number,
    costPrice: number,
    quantity: number,
    lowStockThreshold: number,
  ) => Promise<{ success: boolean; error?: string; changes?: number }>;
  softDeleteProduct: (
    sessionId: string,
    id: number,
  ) => Promise<{ success: boolean; error?: string; changes?: number }>;
  updateProductStock: (
    sessionId: string,
    productId: number,
    newQuantity: number,
  ) => Promise<{ success: boolean; error?: string; changes?: number }>;
  addProductStock: (
    sessionId: string,
    productId: number,
    quantity: number,
  ) => Promise<{ success: boolean; error?: string; oldQuantity?: number; newQuantity?: number }>;
  removeProductStock: (
    sessionId: string,
    productId: number,
    quantity: number,
  ) => Promise<{ success: boolean; error?: string; oldQuantity?: number; newQuantity?: number }>;
  getLowStockCount: (sessionId: string) => Promise<number>;
  getActiveProducts: (sessionId: string) => Promise<ProductRecord[]>;

  // Expense Category methods
  getAllExpenseCategories: (
    sessionId: string,
    limit?: number,
    offset?: number,
    includeDeleted?: boolean,
  ) => Promise<CategoryRecord[]>;
  getExpenseCategoryById: (sessionId: string, id: number) => Promise<CategoryRecord | undefined>;
  createExpenseCategory: (
    sessionId: string,
    name: string,
  ) => Promise<{ success: boolean; error?: string; id?: number }>;
  updateExpenseCategory: (
    sessionId: string,
    id: number,
    name: string,
  ) => Promise<{ success: boolean; error?: string; changes?: number }>;
  softDeleteExpenseCategory: (
    sessionId: string,
    id: number,
  ) => Promise<{ success: boolean; error?: string; changes?: number }>;
  getActiveExpenseCategories: (sessionId: string) => Promise<CategoryRecord[]>;

  // Expense methods
  getAllExpenses: (
    sessionId: string,
    limit?: number,
    offset?: number,
    includeDeleted?: boolean,
  ) => Promise<ExpenseRecord[]>;
  getExpenseById: (sessionId: string, id: number) => Promise<ExpenseRecord | undefined>;
  createExpense: (
    sessionId: string,
    category: string,
    amount: number,
    description: string,
  ) => Promise<{ success: boolean; error?: string; id?: number }>;
  updateExpense: (
    sessionId: string,
    id: number,
    category: string,
    amount: number,
    description: string,
  ) => Promise<{ success: boolean; error?: string; changes?: number }>;
  softDeleteExpense: (
    sessionId: string,
    id: number,
  ) => Promise<{ success: boolean; error?: string; changes?: number }>;
  getExpenseCategories: (sessionId: string) => Promise<CategoryRecord[]>;

  // Audit Log methods
  getAuditLog: (
    sessionId: string,
    limit?: number,
    offset?: number,
    entityType?: string,
    entityId?: number,
  ) => Promise<AuditEntry[]>;
  getAuditLogByEntity: (
    sessionId: string,
    entityType: string,
    entityId: number,
  ) => Promise<AuditEntry[]>;
  getAuditLogCount: (sessionId: string, entityType?: string, entityId?: number) => Promise<number>;

  // Commission methods
  getCommissionRate: (sessionId: string, barberId: number) => Promise<CommissionRateRecord | null>;
  getCommissionDues: (
    sessionId: string,
    barberId: number,
    startDate: string,
    endDate: string,
  ) => Promise<number>;
  setCommissionRate: (
    sessionId: string,
    barberId: number,
    rate: number,
  ) => Promise<{ success: boolean; error?: string }>;

  // EOD methods
  getEodStatus: (sessionId: string) => Promise<{ today: string } | null>;
  getEodSummary: (
    sessionId: string,
    date: string,
    stationId?: number,
  ) => Promise<{
    date: string;
    stationId: number;
    salesCount: number;
    salesTotal: number;
    expenseTotal: number;
    closed: boolean;
    closing: DailyClosingRecord | null;
  } | null>;
  closeDay: (
    sessionId: string,
    date: string,
    countedCash: number,
    stationId?: number,
  ) => Promise<{ success: boolean; error?: string; closing?: DailyClosingRecord }>;
  getEodClosings: (
    sessionId: string,
    limit?: number,
    offset?: number,
  ) => Promise<DailyClosingRecord[]>;

  // Sales methods
  getSaleById: (sessionId: string, id: number) => Promise<SaleRecord | undefined>;
  getAllSales: (sessionId: string, limit?: number, offset?: number) => Promise<SaleRecord[]>;
  getSalesForBarber: (sessionId: string, barberId: number, date: string) => Promise<SaleRecord[]>;
  getSaleLines: (
    sessionId: string,
    saleId: number,
  ) => Promise<{
    serviceLines: Array<{
      id: number;
      itemId: number;
      name: string;
      price: number;
      quantity: number;
      lineTotal: number;
    }>;
    productLines: Array<{
      id: number;
      itemId: number;
      name: string;
      price: number;
      costPrice: number;
      quantity: number;
      lineTotal: number;
    }>;
  }>;
  createSale: (
    sessionId: string,
    barberId: number,
    stationId: number,
    lines: Array<{ type: "service" | "product"; itemId: number; name: string; quantity: number }>,
  ) => Promise<{ success: boolean; error?: string; id?: number; totalAmount?: number }>;
  correctSale: (sessionId: string, saleId: number) => Promise<{ success: boolean; error?: string }>;

  // System event log
  logEvent: (
    sessionId: string,
    eventType: string,
    details: string,
    stationId?: number,
  ) => Promise<void>;
  getEvents: (sessionId: string, limit?: number, offset?: number) => Promise<EventRecord[]>;

  // Report methods (owner only)
  getReportPresetRange: (
    sessionId: string,
    preset: "daily" | "weekly" | "monthly",
    date?: string,
  ) => Promise<{ startDate: string; endDate: string } | null>;
  getReport: (
    sessionId: string,
    report: ReportName,
    startDate: string,
    endDate: string,
    barberId?: number,
  ) => Promise<ReportPayload | null>;
  getReportPrintHtml: (
    sessionId: string,
    report: ReportName,
    startDate: string,
    endDate: string,
    barberId?: number,
  ) => Promise<string | null>;
  printReport: (
    sessionId: string,
    report: ReportName,
    startDate: string,
    endDate: string,
    barberId?: number,
  ) => Promise<{ success: boolean; error?: string }>;
  exportReport: (
    sessionId: string,
    report: ReportName,
    startDate: string,
    endDate: string,
    barberId?: number,
  ) => Promise<{ success: boolean; error?: string; path?: string }>;
  getReportExcelBase64: (
    sessionId: string,
    report: ReportName,
    startDate: string,
    endDate: string,
    barberId?: number,
  ) => Promise<{ success: boolean; base64: string } | null>;
}

interface AuthApi {
  login: (
    username: string,
    password: string,
    stationId: number,
  ) => Promise<{
    success: boolean;
    error?: string;
    user?: { id: number; username: string; role: string };
    sessionId?: string;
  }>;
  loginPin: (
    pin: string,
    stationId: number,
  ) => Promise<{
    success: boolean;
    error?: string;
    user?: { id: number; username: string; role: string };
    sessionId?: string;
  }>;
  logout: (sessionId: string) => Promise<{ success: boolean; error?: string }>;
  verifySession: (
    sessionId: string,
  ) => Promise<{ valid: boolean; user?: { id: number; username: string; role: string } }>;
  getCurrentUser: (
    sessionId: string,
  ) => Promise<{ user?: { id: number; username: string; role: string } }>;
  changePassword: (
    sessionId: string,
    oldPassword: string,
    newPassword: string,
  ) => Promise<{ success: boolean; error?: string }>;
  setPin: (sessionId: string, pin: string) => Promise<{ success: boolean; error?: string }>;
  createUser: (
    sessionId: string,
    username: string,
    role: UserRole,
    password?: string,
    pin?: string,
  ) => Promise<{ success: boolean; error?: string; userId?: number }>;
  deactivateUser: (
    sessionId: string,
    userId: number,
  ) => Promise<{ success: boolean; error?: string }>;
  listUsers: (sessionId: string) => Promise<{
    users: { id: number; username: string; role: string; isActive: number; createdAt: string }[];
  }>;
  getActiveBarbers: (sessionId: string) => Promise<{ id: number; username: string }[]>;
  checkOwnerExists: () => Promise<{ exists: boolean }>;
  firstRunSetup: (
    username: string,
    password: string,
  ) => Promise<{ success: boolean; error?: string; userId?: number }>;
}

contextBridge.exposeInMainWorld("api", {
  getDbPath: () => ipcRenderer.invoke("get-db-path"),

  // Service methods
  getAllServices: (sessionId: string, limit = 100, offset = 0, includeDeleted = false) =>
    ipcRenderer.invoke("services:getAll", sessionId, limit, offset, includeDeleted),
  getServiceById: (sessionId: string, id: number) =>
    ipcRenderer.invoke("services:getById", sessionId, id),
  createService: (sessionId: string, name: string, description: string, price: number) =>
    ipcRenderer.invoke("services:create", sessionId, name, description, price),
  updateService: (
    sessionId: string,
    id: number,
    name: string,
    description: string,
    price: number,
  ) => ipcRenderer.invoke("services:update", sessionId, id, name, description, price),
  softDeleteService: (sessionId: string, id: number) =>
    ipcRenderer.invoke("services:delete", sessionId, id),
  getActiveServices: (sessionId: string) => ipcRenderer.invoke("services:getActive", sessionId),

  // Product methods
  getAllProducts: (sessionId: string, limit = 100, offset = 0, includeDeleted = false) =>
    ipcRenderer.invoke("products:getAll", sessionId, limit, offset, includeDeleted),
  getLowStockProducts: (sessionId: string) => ipcRenderer.invoke("products:getLowStock", sessionId),
  getProductById: (sessionId: string, id: number) =>
    ipcRenderer.invoke("products:getById", sessionId, id),
  createProduct: (
    sessionId: string,
    name: string,
    price: number,
    costPrice: number,
    quantity: number,
    lowStockThreshold: number,
  ) =>
    ipcRenderer.invoke(
      "products:create",
      sessionId,
      name,
      price,
      costPrice,
      quantity,
      lowStockThreshold,
    ),
  updateProduct: (
    sessionId: string,
    id: number,
    name: string,
    price: number,
    costPrice: number,
    quantity: number,
    lowStockThreshold: number,
  ) =>
    ipcRenderer.invoke(
      "products:update",
      sessionId,
      id,
      name,
      price,
      costPrice,
      quantity,
      lowStockThreshold,
    ),
  softDeleteProduct: (sessionId: string, id: number) =>
    ipcRenderer.invoke("products:delete", sessionId, id),
  updateProductStock: (sessionId: string, productId: number, newQuantity: number) =>
    ipcRenderer.invoke("products:updateStock", sessionId, productId, newQuantity),
  addProductStock: (sessionId: string, productId: number, quantity: number) =>
    ipcRenderer.invoke("products:addStock", sessionId, productId, quantity),
  removeProductStock: (sessionId: string, productId: number, quantity: number) =>
    ipcRenderer.invoke("products:removeStock", sessionId, productId, quantity),
  getLowStockCount: (sessionId: string) =>
    ipcRenderer.invoke("products:getLowStockCount", sessionId),
  getActiveProducts: (sessionId: string) => ipcRenderer.invoke("products:getActive", sessionId),

  // Expense Category methods
  getAllExpenseCategories: (sessionId: string, limit = 100, offset = 0, includeDeleted = false) =>
    ipcRenderer.invoke("expenseCategories:getAll", sessionId, limit, offset, includeDeleted),
  getExpenseCategoryById: (sessionId: string, id: number) =>
    ipcRenderer.invoke("expenseCategories:getById", sessionId, id),
  createExpenseCategory: (sessionId: string, name: string) =>
    ipcRenderer.invoke("expenseCategories:create", sessionId, name),
  updateExpenseCategory: (sessionId: string, id: number, name: string) =>
    ipcRenderer.invoke("expenseCategories:update", sessionId, id, name),
  softDeleteExpenseCategory: (sessionId: string, id: number) =>
    ipcRenderer.invoke("expenseCategories:delete", sessionId, id),
  getActiveExpenseCategories: (sessionId: string) =>
    ipcRenderer.invoke("expenseCategories:getActive", sessionId),

  // Expense methods
  getAllExpenses: (sessionId: string, limit = 100, offset = 0, includeDeleted = false) =>
    ipcRenderer.invoke("expenses:getAll", sessionId, limit, offset, includeDeleted),
  getExpenseById: (sessionId: string, id: number) =>
    ipcRenderer.invoke("expenses:getById", sessionId, id),
  createExpense: (sessionId: string, category: string, amount: number, description: string) =>
    ipcRenderer.invoke("expenses:create", sessionId, category, amount, description),
  updateExpense: (
    sessionId: string,
    id: number,
    category: string,
    amount: number,
    description: string,
  ) => ipcRenderer.invoke("expenses:update", sessionId, id, category, amount, description),
  softDeleteExpense: (sessionId: string, id: number) =>
    ipcRenderer.invoke("expenses:delete", sessionId, id),
  getExpenseCategories: (sessionId: string) =>
    ipcRenderer.invoke("expenses:getCategories", sessionId),

  // Audit Log methods
  getAuditLog: (
    sessionId: string,
    limit = 100,
    offset = 0,
    entityType?: string,
    entityId?: number,
  ) => ipcRenderer.invoke("auditLog:getAll", sessionId, limit, offset, entityType, entityId),
  getAuditLogByEntity: (sessionId: string, entityType: string, entityId: number) =>
    ipcRenderer.invoke("auditLog:getByEntity", sessionId, entityType, entityId),
  getAuditLogCount: (sessionId: string, entityType?: string, entityId?: number) =>
    ipcRenderer.invoke("auditLog:getCount", sessionId, entityType, entityId),

  // Commission methods
  getCommissionRate: (sessionId: string, barberId: number) =>
    ipcRenderer.invoke("commission:getRate", sessionId, barberId),
  getCommissionDues: (sessionId: string, barberId: number, startDate: string, endDate: string) =>
    ipcRenderer.invoke("commission:getDues", sessionId, barberId, startDate, endDate),
  setCommissionRate: (sessionId: string, barberId: number, rate: number) =>
    ipcRenderer.invoke("commission:setRate", sessionId, barberId, rate),

  // EOD methods
  getEodStatus: (sessionId: string) => ipcRenderer.invoke("eod:getStatus", sessionId),
  getEodSummary: (sessionId: string, date: string, stationId?: number) =>
    ipcRenderer.invoke("eod:getSummary", sessionId, date, stationId),
  closeDay: (sessionId: string, date: string, countedCash: number, stationId?: number) =>
    ipcRenderer.invoke("eod:closeDay", sessionId, date, countedCash, stationId),
  getEodClosings: (sessionId: string, limit?: number, offset?: number) =>
    ipcRenderer.invoke("eod:getClosings", sessionId, limit, offset),

  // Sales methods
  getSaleById: (sessionId: string, id: number) =>
    ipcRenderer.invoke("sales:getById", sessionId, id),
  getAllSales: (sessionId: string, limit = 100, offset = 0) =>
    ipcRenderer.invoke("sales:getAll", sessionId, limit, offset),
  getSalesForBarber: (sessionId: string, barberId: number, date: string) =>
    ipcRenderer.invoke("sales:getForBarber", sessionId, barberId, date),
  getSaleLines: (sessionId: string, saleId: number) =>
    ipcRenderer.invoke("sales:getLines", sessionId, saleId),
  createSale: (
    sessionId: string,
    barberId: number,
    stationId: number,
    lines: Array<{ type: "service" | "product"; itemId: number; name: string; quantity: number }>,
  ) => ipcRenderer.invoke("sales:create", sessionId, barberId, stationId, lines),
  correctSale: (sessionId: string, saleId: number) =>
    ipcRenderer.invoke("sales:correct", sessionId, saleId),

  // System event log
  logEvent: (sessionId: string, eventType: string, details: string, stationId?: number) =>
    ipcRenderer.invoke("log-event", sessionId, eventType, details, stationId),
  getEvents: (sessionId: string, limit?: number, offset?: number) =>
    ipcRenderer.invoke("get-events", sessionId, limit, offset),

  // Report methods
  getReportPresetRange: (
    sessionId: string,
    preset: "daily" | "weekly" | "monthly",
    date?: string,
  ) => ipcRenderer.invoke("reports:getPresetRange", sessionId, preset, date),
  getReport: (
    sessionId: string,
    report: ReportName,
    startDate: string,
    endDate: string,
    barberId?: number,
  ) => ipcRenderer.invoke("reports:get", sessionId, report, startDate, endDate, barberId),
  getReportPrintHtml: (
    sessionId: string,
    report: ReportName,
    startDate: string,
    endDate: string,
    barberId?: number,
  ) => ipcRenderer.invoke("reports:getPrintHtml", sessionId, report, startDate, endDate, barberId),
  printReport: (
    sessionId: string,
    report: ReportName,
    startDate: string,
    endDate: string,
    barberId?: number,
  ) => ipcRenderer.invoke("reports:print", sessionId, report, startDate, endDate, barberId),
  exportReport: (
    sessionId: string,
    report: ReportName,
    startDate: string,
    endDate: string,
    barberId?: number,
  ) => ipcRenderer.invoke("reports:exportExcel", sessionId, report, startDate, endDate, barberId),
  getReportExcelBase64: (
    sessionId: string,
    report: ReportName,
    startDate: string,
    endDate: string,
    barberId?: number,
  ) =>
    ipcRenderer.invoke("reports:getExcelBase64", sessionId, report, startDate, endDate, barberId),
} as DbApi);

contextBridge.exposeInMainWorld("auth", {
  login: (username: string, password: string, stationId: number) =>
    ipcRenderer.invoke("auth:login", username, password, stationId),
  loginPin: (pin: string, stationId: number) => ipcRenderer.invoke("auth:loginPin", pin, stationId),
  logout: (sessionId: string) => ipcRenderer.invoke("auth:logout", sessionId),
  verifySession: (sessionId: string) => ipcRenderer.invoke("auth:verifySession", sessionId),
  getCurrentUser: (sessionId: string) => ipcRenderer.invoke("auth:getCurrentUser", sessionId),
  changePassword: (sessionId: string, oldPassword: string, newPassword: string) =>
    ipcRenderer.invoke("auth:changePassword", sessionId, oldPassword, newPassword),
  setPin: (sessionId: string, pin: string) => ipcRenderer.invoke("auth:setPin", sessionId, pin),
  createUser: (
    sessionId: string,
    username: string,
    role: UserRole,
    password?: string,
    pin?: string,
  ) => ipcRenderer.invoke("auth:createUser", sessionId, username, role, password, pin),
  deactivateUser: (sessionId: string, userId: number) =>
    ipcRenderer.invoke("auth:deactivateUser", sessionId, userId),
  listUsers: (sessionId: string) => ipcRenderer.invoke("auth:listUsers", sessionId),
  getActiveBarbers: (sessionId: string) => ipcRenderer.invoke("users:getActiveBarbers", sessionId),
  checkOwnerExists: () => ipcRenderer.invoke("auth:checkOwnerExists"),
  firstRunSetup: (username: string, password: string) =>
    ipcRenderer.invoke("auth:firstRunSetup", username, password),
} as AuthApi);

export type {
  DbApi,
  AuthApi,
  ServiceRecord,
  ProductRecord,
  CategoryRecord,
  ExpenseRecord,
  AuditEntry,
  EventRecord,
  CommissionRateRecord,
  SaleRecord,
  DailyClosingRecord,
};
