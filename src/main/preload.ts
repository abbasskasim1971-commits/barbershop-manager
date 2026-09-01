import { contextBridge, ipcRenderer } from 'electron';

interface DbApi {
  query: (sql: string, params?: unknown[]) => Promise<unknown[]>;
  getOne: (sql: string, params?: unknown[]) => Promise<unknown>;
  runSql: (sql: string, params?: unknown[]) => Promise<{ changes: number; lastInsertRowid: number }>;
  insert: (table: string, row: Record<string, unknown>) => Promise<{ changes: number; lastInsertRowid: number }>;
  update: (table: string, id: number, row: Record<string, unknown>) => Promise<{ changes: number }>;
  softDelete: (table: string, id: number) => Promise<{ changes: number }>;
  getDbPath: () => Promise<string>;
  getMigrations: () => Promise<{ name: string }[]>;
  addMigration: (name: string) => Promise<void>;
  logEvent: (eventType: string, details: string, stationId?: number) => Promise<void>;
  getEvents: (limit?: number, offset?: number) => Promise<unknown[]>;

  // Service methods
  getAllServices: (limit?: number, offset?: number, includeDeleted?: boolean) => Promise<unknown[]>;
  getServiceById: (id: number) => Promise<unknown>;
  createService: (name: string, description: string, price: number) => Promise<{ changes: number; lastInsertRowid: number }>;
  updateService: (id: number, name: string, description: string, price: number) => Promise<{ changes: number }>;
  softDeleteService: (id: number) => Promise<{ changes: number }>;
  getActiveServices: () => Promise<unknown[]>;

  // Product methods
  getAllProducts: (limit?: number, offset?: number, includeDeleted?: boolean) => Promise<unknown[]>;
  getLowStockProducts: (threshold?: number) => Promise<unknown[]>;
  getProductById: (id: number) => Promise<unknown>;
  createProduct: (name: string, price: number, costPrice: number, quantity: number, lowStockThreshold: number) => Promise<{ changes: number; lastInsertRowid: number }>;
  updateProduct: (id: number, name: string, price: number, costPrice: number, quantity: number, lowStockThreshold: number) => Promise<{ changes: number }>;
  softDeleteProduct: (id: number) => Promise<{ changes: number }>;
  updateProductStock: (productId: number, newQuantity: number) => Promise<{ changes: number }>;
  getLowStockCount: () => Promise<number>;
  getActiveProducts: () => Promise<unknown[]>;

  // Expense Category methods
  getAllExpenseCategories: (limit?: number, offset?: number, includeDeleted?: boolean) => Promise<unknown[]>;
  getExpenseCategoryById: (id: number) => Promise<unknown>;
  createExpenseCategory: (name: string) => Promise<{ changes: number; lastInsertRowid: number }>;
  updateExpenseCategory: (id: number, name: string) => Promise<{ changes: number }>;
  softDeleteExpenseCategory: (id: number) => Promise<{ changes: number }>;
  getActiveExpenseCategories: () => Promise<unknown[]>;

  // Expense methods
  getAllExpenses: (limit?: number, offset?: number, includeDeleted?: boolean) => Promise<unknown[]>;
  getExpenseById: (id: number) => Promise<unknown>;
  createExpense: (category: string, amount: number, description: string) => Promise<{ changes: number; lastInsertRowid: number }>;
  updateExpense: (id: number, category: string, amount: number, description: string) => Promise<{ changes: number }>;
  softDeleteExpense: (id: number) => Promise<{ changes: number }>;
  getExpenseCategories: () => Promise<unknown[]>;

  // Audit Log methods
  getAuditLog: (limit?: number, offset?: number, entityType?: string, entityId?: number) => Promise<unknown[]>;
  getAuditLogByEntity: (entityType: string, entityId: number) => Promise<unknown[]>;
  getAuditLogCount: (entityType?: string, entityId?: number) => Promise<number>;
}

interface AuthApi {
  login: (username: string, password: string, stationId: number) => Promise<{ success: boolean; error?: string; user?: { id: number; username: string; role: string }; sessionId?: string }>;
  loginPin: (pin: string, stationId: number) => Promise<{ success: boolean; error?: string; user?: { id: number; username: string; role: string }; sessionId?: string }>;
  logout: (sessionId: string) => Promise<{ success: boolean; error?: string }>;
  verifySession: (sessionId: string) => Promise<{ valid: boolean; user?: { id: number; username: string; role: string } }>;
  getCurrentUser: (sessionId: string) => Promise<{ user?: { id: number; username: string; role: string } }>;
  changePassword: (sessionId: string, oldPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  setPin: (sessionId: string, pin: string) => Promise<{ success: boolean; error?: string }>;
  createUser: (sessionId: string, username: string, role: 'owner' | 'manager' | 'barber', password?: string, pin?: string) => Promise<{ success: boolean; error?: string; userId?: number }>;
  deactivateUser: (sessionId: string, userId: number) => Promise<{ success: boolean; error?: string }>;
  listUsers: (sessionId: string) => Promise<{ users: { id: number; username: string; role: string; isActive: number; createdAt: string }[] }>;
  checkOwnerExists: () => Promise<{ exists: boolean }>;
  firstRunSetup: (username: string, password: string) => Promise<{ success: boolean; error?: string; userId?: number }>;
}

contextBridge.exposeInMainWorld('api', {
  query: (sql: string, params?: unknown[]) => ipcRenderer.invoke('query', sql, params),
  getOne: (sql: string, params?: unknown[]) => ipcRenderer.invoke('get-one', sql, params),
  runSql: (sql: string, params?: unknown[]) => ipcRenderer.invoke('run-sql', sql, params),
  insert: (table: string, row: Record<string, unknown>) => ipcRenderer.invoke('insert', table, row),
  update: (table: string, id: number, row: Record<string, unknown>) => ipcRenderer.invoke('update', table, id, row),
  softDelete: (table: string, id: number) => ipcRenderer.invoke('soft-delete', table, id),
  getDbPath: () => ipcRenderer.invoke('get-db-path'),
  getMigrations: () => ipcRenderer.invoke('get-migrations'),
  addMigration: (name: string) => ipcRenderer.invoke('add-migration', name),
  logEvent: (eventType: string, details: string, stationId?: number) => ipcRenderer.invoke('log-event', eventType, details, stationId),
  getEvents: (limit?: number, offset?: number) => ipcRenderer.invoke('get-events', limit, offset),

  // Service methods
  getAllServices: (limit?: number, offset?: number, includeDeleted?: boolean) => ipcRenderer.invoke('services:getAll', limit, offset, includeDeleted),
  getServiceById: (id: number) => ipcRenderer.invoke('services:getById', id),
  createService: (name: string, description: string, price: number) => ipcRenderer.invoke('services:create', name, description, price),
  updateService: (id: number, name: string, description: string, price: number) => ipcRenderer.invoke('services:update', id, name, description, price),
  softDeleteService: (id: number) => ipcRenderer.invoke('services:delete', id),
  getActiveServices: () => ipcRenderer.invoke('services:getActive'),

  // Product methods
  getAllProducts: (limit?: number, offset?: number, includeDeleted?: boolean) => ipcRenderer.invoke('products:getAll', limit, offset, includeDeleted),
  getLowStockProducts: (threshold?: number) => ipcRenderer.invoke('products:getLowStock', threshold),
  getProductById: (id: number) => ipcRenderer.invoke('products:getById', id),
  createProduct: (name: string, price: number, costPrice: number, quantity: number, lowStockThreshold: number) => ipcRenderer.invoke('products:create', name, price, costPrice, quantity, lowStockThreshold),
  updateProduct: (id: number, name: string, price: number, costPrice: number, quantity: number, lowStockThreshold: number) => ipcRenderer.invoke('products:update', id, name, price, costPrice, quantity, lowStockThreshold),
  softDeleteProduct: (id: number) => ipcRenderer.invoke('products:delete', id),
  updateProductStock: (productId: number, newQuantity: number) => ipcRenderer.invoke('products:updateStock', productId, newQuantity),
  getLowStockCount: () => ipcRenderer.invoke('products:getLowStockCount'),
  getActiveProducts: () => ipcRenderer.invoke('products:getActive'),

  // Expense Category methods
  getAllExpenseCategories: (limit?: number, offset?: number, includeDeleted?: boolean) => ipcRenderer.invoke('expenseCategories:getAll', limit, offset, includeDeleted),
  getExpenseCategoryById: (id: number) => ipcRenderer.invoke('expenseCategories:getById', id),
  createExpenseCategory: (name: string) => ipcRenderer.invoke('expenseCategories:create', name),
  updateExpenseCategory: (id: number, name: string) => ipcRenderer.invoke('expenseCategories:update', id, name),
  softDeleteExpenseCategory: (id: number) => ipcRenderer.invoke('expenseCategories:delete', id),
  getActiveExpenseCategories: () => ipcRenderer.invoke('expenseCategories:getActive'),

  // Expense methods
  getAllExpenses: (limit?: number, offset?: number, includeDeleted?: boolean) => ipcRenderer.invoke('expenses:getAll', limit, offset, includeDeleted),
  getExpenseById: (id: number) => ipcRenderer.invoke('expenses:getById', id),
  createExpense: (category: string, amount: number, description: string) => ipcRenderer.invoke('expenses:create', category, amount, description),
  updateExpense: (id: number, category: string, amount: number, description: string) => ipcRenderer.invoke('expenses:update', id, category, amount, description),
  softDeleteExpense: (id: number) => ipcRenderer.invoke('expenses:delete', id),
  getExpenseCategories: () => ipcRenderer.invoke('expenses:getCategories'),

  // Audit Log methods
  getAuditLog: (limit?: number, offset?: number, entityType?: string, entityId?: number) => ipcRenderer.invoke('auditLog:getAll', limit, offset, entityType, entityId),
  getAuditLogByEntity: (entityType: string, entityId: number) => ipcRenderer.invoke('auditLog:getByEntity', entityType, entityId),
  getAuditLogCount: (entityType?: string, entityId?: number) => ipcRenderer.invoke('auditLog:getCount', entityType, entityId),
} as DbApi);

contextBridge.exposeInMainWorld('auth', {
  login: (username: string, password: string, stationId: number) => ipcRenderer.invoke('auth:login', username, password, stationId),
  loginPin: (pin: string, stationId: number) => ipcRenderer.invoke('auth:loginPin', pin, stationId),
  logout: (sessionId: string) => ipcRenderer.invoke('auth:logout', sessionId),
  verifySession: (sessionId: string) => ipcRenderer.invoke('auth:verifySession', sessionId),
  getCurrentUser: (sessionId: string) => ipcRenderer.invoke('auth:getCurrentUser', sessionId),
  changePassword: (sessionId: string, oldPassword: string, newPassword: string) => ipcRenderer.invoke('auth:changePassword', sessionId, oldPassword, newPassword),
  setPin: (sessionId: string, pin: string) => ipcRenderer.invoke('auth:setPin', sessionId, pin),
  createUser: (sessionId: string, username: string, role: 'owner' | 'manager' | 'barber', password?: string, pin?: string) => ipcRenderer.invoke('auth:createUser', sessionId, username, role, password, pin),
  deactivateUser: (sessionId: string, userId: number) => ipcRenderer.invoke('auth:deactivateUser', sessionId, userId),
  listUsers: (sessionId: string) => ipcRenderer.invoke('auth:listUsers', sessionId),
  checkOwnerExists: () => ipcRenderer.invoke('auth:checkOwnerExists'),
  firstRunSetup: (username: string, password: string) => ipcRenderer.invoke('auth:firstRunSetup', username, password),
} as AuthApi);

export type { DbApi, AuthApi };