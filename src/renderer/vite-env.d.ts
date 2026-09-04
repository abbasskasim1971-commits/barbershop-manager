/// <reference types="vite/client" />

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

interface SaleLine {
  type: "service" | "product";
  itemId: number;
  name: string;
  quantity: number;
}

interface DbApi {
  getDbPath: () => Promise<string>;

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

  getSaleById: (sessionId: string, id: number) => Promise<SaleRecord | undefined>;
  getAllSales: (sessionId: string, limit?: number, offset?: number) => Promise<SaleRecord[]>;
  getSalesForBarber: (sessionId: string, barberId: number, date: string) => Promise<SaleRecord[]>;
  createSale: (
    sessionId: string,
    barberId: number,
    stationId: number,
    lines: SaleLine[],
  ) => Promise<{ success: boolean; error?: string; id?: number; totalAmount?: number }>;
  correctSale: (sessionId: string, saleId: number) => Promise<{ success: boolean; error?: string }>;
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

  logEvent: (
    sessionId: string,
    eventType: string,
    details: string,
    stationId?: number,
  ) => Promise<void>;
  getEvents: (sessionId: string, limit?: number, offset?: number) => Promise<EventRecord[]>;
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
  checkOwnerExists: () => Promise<{ exists: boolean }>;
  firstRunSetup: (
    username: string,
    password: string,
  ) => Promise<{ success: boolean; error?: string; userId?: number }>;
  getActiveBarbers: (sessionId: string) => Promise<{ id: number; username: string }[]>;
}

declare global {
  interface Window {
    api: DbApi;
    auth: AuthApi;
  }
}

export {};
