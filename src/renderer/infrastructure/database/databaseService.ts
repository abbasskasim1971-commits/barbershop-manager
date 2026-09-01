const api = window.api;
const authApi = window.auth;

export async function query<T = unknown>(sql: string, params?: unknown[]): Promise<T[][]> {
  return (await api.query(sql, params)) as T[][];
}

export async function getOne<T = unknown>(sql: string, params?: unknown[]): Promise<T | undefined> {
  return (await api.getOne(sql, params)) as T | undefined;
}

export async function runSql(
  sql: string,
  params?: unknown[],
): Promise<{ changes: number; lastInsertRowid: number }> {
  return (await api.runSql(sql, params)) as { changes: number; lastInsertRowid: number };
}

export async function insert(table: string, row: Record<string, unknown>) {
  return api.insert(table, row);
}

export async function update(table: string, id: number, row: Record<string, unknown>) {
  return api.update(table, id, row);
}

export async function softDelete(table: string, id: number) {
  return api.softDelete(table, id);
}

export async function getDbPath(): Promise<string> {
  return api.getDbPath();
}

export async function addMigration(name: string) {
  return api.addMigration(name);
}

export async function logEvent(eventType: string, details: string, stationId?: number) {
  return api.logEvent(eventType, details, stationId);
}

export async function getEvents(limit?: number, offset?: number) {
  return (await api.getEvents(limit, offset)) as unknown[][];
}

// Service methods
export async function getAllServices(limit = 100, offset = 0, includeDeleted = false) {
  const whereClause = includeDeleted ? "" : "WHERE is_deleted = 0";
  return query(`SELECT * FROM services ${whereClause} ORDER BY name LIMIT ? OFFSET ?`, [
    limit,
    offset,
  ]);
}

export async function getServiceById(id: number) {
  return getOne("SELECT * FROM services WHERE id = ?", [id]);
}

export async function createService(name: string, description: string, price: number) {
  return insert("services", {
    name: name.trim(),
    description: description?.trim() || "",
    price,
    is_deleted: 0,
  });
}

export async function updateService(id: number, name: string, description: string, price: number) {
  return update("services", id, {
    name: name.trim(),
    description: description?.trim() || "",
    price,
  });
}

export async function softDeleteService(id: number) {
  return softDelete("services", id);
}

export async function getActiveServices() {
  return query("SELECT * FROM services WHERE is_deleted = 0 ORDER BY name");
}

// Product methods
export async function getAllProducts(limit = 100, offset = 0, includeDeleted = false) {
  const whereClause = includeDeleted ? "" : "WHERE is_deleted = 0";
  return query(`SELECT * FROM products ${whereClause} ORDER BY name LIMIT ? OFFSET ?`, [
    limit,
    offset,
  ]);
}

export async function getLowStockProducts(threshold = 5) {
  return query("SELECT * FROM products WHERE quantity < ? AND is_deleted = 0", [threshold]);
}

export async function getProductById(id: number) {
  return getOne("SELECT * FROM products WHERE id = ?", [id]);
}

export async function createProduct(
  name: string,
  price: number,
  costPrice: number,
  quantity: number,
  lowStockThreshold: number,
) {
  return insert("products", {
    name: name.trim(),
    price,
    cost_price: costPrice,
    quantity,
    low_stock_threshold: lowStockThreshold,
    is_deleted: 0,
  });
}

export async function updateProduct(
  id: number,
  name: string,
  price: number,
  costPrice: number,
  quantity: number,
  lowStockThreshold: number,
) {
  return update("products", id, {
    name: name.trim(),
    price,
    cost_price: costPrice,
    quantity,
    low_stock_threshold: lowStockThreshold,
  });
}

export async function softDeleteProduct(id: number) {
  return softDelete("products", id);
}

export async function updateProductStock(productId: number, newQuantity: number) {
  return update("products", productId, { quantity: newQuantity });
}

export async function getLowStockCount() {
  const result = await query(
    "SELECT COUNT(*) as count FROM products WHERE quantity <= low_stock_threshold AND is_deleted = 0",
  );
  return (result[0]?.[0] as number) || 0;
}

export async function getActiveProducts() {
  return query("SELECT * FROM products WHERE is_deleted = 0 ORDER BY name");
}

// Expense Category methods
export async function getAllExpenseCategories(limit = 100, offset = 0, includeDeleted = false) {
  const whereClause = includeDeleted ? "" : "WHERE is_deleted = 0";
  return query(`SELECT * FROM expense_categories ${whereClause} ORDER BY name LIMIT ? OFFSET ?`, [
    limit,
    offset,
  ]);
}

export async function getExpenseCategoryById(id: number) {
  return query("SELECT * FROM expense_categories WHERE id = ?", [id]);
}

export async function createExpenseCategory(name: string) {
  return insert("expense_categories", {
    name: name.trim(),
    is_deleted: 0,
  });
}

export async function updateExpenseCategory(id: number, name: string) {
  return update("expense_categories", id, { name: name.trim() });
}

export async function softDeleteExpenseCategory(id: number) {
  return softDelete("expense_categories", id);
}

export async function getActiveExpenseCategories() {
  return query("SELECT * FROM expense_categories WHERE is_deleted = 0 ORDER BY name");
}

// Expense methods
export async function getAllExpenses(limit = 100, offset = 0, includeDeleted = false) {
  const whereClause = includeDeleted ? "" : "WHERE is_deleted = 0";
  return query(`SELECT * FROM expenses ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [
    limit,
    offset,
  ]);
}

export async function getExpenseById(id: number) {
  return getOne("SELECT * FROM expenses WHERE id = ?", [id]);
}

export async function createExpense(category: string, amount: number, description: string) {
  return insert("expenses", {
    category: category.trim(),
    amount,
    description: description?.trim() || "",
    is_deleted: 0,
  });
}

export async function updateExpense(
  id: number,
  category: string,
  amount: number,
  description: string,
) {
  return update("expenses", id, {
    category: category.trim(),
    amount,
    description: description?.trim() || "",
  });
}

export async function softDeleteExpense(id: number) {
  return softDelete("expenses", id);
}

export async function getExpenseCategories() {
  return query("SELECT * FROM expense_categories WHERE is_deleted = 0 ORDER BY name");
}

// Audit Log methods
export async function getAuditLog(limit = 100, offset = 0, entityType?: string, entityId?: number) {
  let whereClause = "";
  const params: unknown[] = [];

  if (entityType && entityId) {
    whereClause = "WHERE entity_type = ? AND entity_id = ?";
    params.push(entityType, entityId);
  } else if (entityType) {
    whereClause = "WHERE entity_type = ?";
    params.push(entityType);
  } else if (entityId) {
    whereClause = "WHERE entity_id = ?";
    params.push(entityId);
  }

  params.push(limit, offset);
  return query(
    `SELECT * FROM audit_log ${whereClause} ORDER BY changed_at DESC LIMIT ? OFFSET ?`,
    params,
  );
}

export async function getAuditLogByEntity(entityType: string, entityId: number) {
  return query(
    "SELECT * FROM audit_log WHERE entity_type = ? AND entity_id = ? ORDER BY changed_at DESC",
    [entityType, entityId],
  );
}

export async function getAuditLogCount(entityType?: string, entityId?: number) {
  let whereClause = "";
  const params: unknown[] = [];

  if (entityType && entityId) {
    whereClause = "WHERE entity_type = ? AND entity_id = ?";
    params.push(entityType, entityId);
  } else if (entityType) {
    whereClause = "WHERE entity_type = ?";
    params.push(entityType);
  } else if (entityId) {
    whereClause = "WHERE entity_id = ?";
    params.push(entityId);
  }

  const result = query(`SELECT COUNT(*) as count FROM audit_log ${whereClause}`, params);
  return (result[0]?.[0] as number) || 0;
}

// Authentication methods
export async function authLogin(username: string, password: string, stationId: number) {
  return authApi.login(username, password, stationId);
}

export async function authLoginPin(pin: string, stationId: number) {
  return authApi.loginPin(pin, stationId);
}

export async function authLogout(sessionId: string) {
  return authApi.logout(sessionId);
}

export async function authVerifySession(sessionId: string) {
  return authApi.verifySession(sessionId);
}

export async function authGetCurrentUser(sessionId: string) {
  return authApi.getCurrentUser(sessionId);
}

export async function authChangePassword(
  sessionId: string,
  oldPassword: string,
  newPassword: string,
) {
  return authApi.changePassword(sessionId, oldPassword, newPassword);
}

export async function authSetPin(sessionId: string, pin: string) {
  return authApi.setPin(sessionId, pin);
}

export async function authCreateUser(
  sessionId: string,
  username: string,
  role: "owner" | "manager" | "barber",
  password?: string,
  pin?: string,
) {
  return authApi.createUser(sessionId, username, role, password, pin);
}

export async function authDeactivateUser(sessionId: string, userId: number) {
  return authApi.deactivateUser(sessionId, userId);
}

export async function authListUsers(sessionId: string) {
  return authApi.listUsers(sessionId);
}

export async function authCheckOwnerExists() {
  return authApi.checkOwnerExists();
}

export async function authFirstRunSetup(username: string, password: string) {
  return authApi.firstRunSetup(username, password);
}
