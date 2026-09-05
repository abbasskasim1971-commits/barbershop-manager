import path from "path";
import * as fs from "fs";
import initSqlJs, { Database, SqlValue, BindParams, SqlJsStatic } from "sql.js";
import { getDatabasePath } from "./paths";

// ── Canonical datetime policy ──────────────────────────────────────────
// All timestamps are stored as UTC ISO-8601 strings (e.g. "2026-09-04T10:00:00.000Z").
// getUtcNow() is the single source of truth for "now".
// The business timezone is Asia/Baghdad (UTC+3).
// Calendar-date filters must convert local dates to UTC ranges using calendarDateToUtcRange().
// ────────────────────────────────────────────────────────────────────────

export const BUSINESS_TZ_OFFSET_HOURS = 3;

export function calendarDateToUtcRange(dateStr: string): { start: string; end: string } {
  const [year, month, day] = dateStr.split("-").map(Number);
  const baghdadMidnightUtcMs =
    Date.UTC(year, month - 1, day, 0, 0, 0) - BUSINESS_TZ_OFFSET_HOURS * 60 * 60 * 1000;
  const start = new Date(baghdadMidnightUtcMs);
  const end = new Date(baghdadMidnightUtcMs + 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function toBaghdadDate(isoUtc: string): string {
  const d = new Date(isoUtc);
  const shifted = new Date(d.getTime() + BUSINESS_TZ_OFFSET_HOURS * 60 * 60 * 1000);
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(
    shifted.getUTCDate(),
  ).padStart(2, "0")}`;
}

export type UserRole = "owner" | "manager" | "barber";

export interface ServiceRecord {
  id: number;
  name: string;
  description: string;
  price: number;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductRecord {
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

export interface CategoryRecord {
  id: number;
  name: string;
  isDeleted: boolean;
  createdAt: string;
}

export interface ExpenseRecord {
  id: number;
  category: string;
  amount: number;
  description: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuditEntry {
  id: number;
  entityType: string;
  entityId: number;
  field: string;
  oldValue: string;
  newValue: string;
  changedBy: string;
  changedAt: string;
}

export interface EventRecord {
  id: number;
  eventType: string;
  details: string;
  stationId: number;
  timestamp: string;
}

export interface CommissionRateRecord {
  id: number;
  barberId: number;
  rate: number;
  effectiveFrom: string;
  isDeleted: boolean;
  createdAt: string;
}

export interface SaleRecord {
  id: number;
  barberId: number;
  stationId: number;
  totalAmount: number;
  cashAmount: number;
  isDeleted: boolean;
  createdAt: string;
  createdBy: number;
}

export interface DailyClosingRecord {
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

let db: Database | null = null;
let SQL: SqlJsStatic | null = null;
let inTransaction = false;

export function getDb(): Database | null {
  return db;
}

export function getUtcNow(): string {
  return new Date().toISOString();
}

export function runQuery(sqlStr: string, params: BindParams = []): SqlValue[][] {
  if (!db) throw new Error("Database not initialized");
  const result = db.exec(sqlStr, params);
  return result[0]?.values || [];
}

export function runOne(sqlStr: string, params: BindParams = []): SqlValue[] | undefined {
  const rows = runQuery(sqlStr, params);
  return rows[0];
}

export function runSql(
  sqlStr: string,
  params: BindParams = [],
): { changes: number; lastInsertRowid: number } {
  if (!db) throw new Error("Database not initialized");
  db.run(sqlStr, params);
  const lastIdResult = db.exec("SELECT last_insert_rowid()");
  const lastId = (lastIdResult[0]?.values[0]?.[0] as number) || 0;
  const changes = db.getRowsModified();
  if (!inTransaction) saveDatabase();
  return { changes, lastInsertRowid: lastId };
}

export function beginTransaction(): void {
  if (!db) throw new Error("Database not initialized");
  inTransaction = true;
  db.exec("BEGIN IMMEDIATE TRANSACTION");
}

export function commitTransaction(): void {
  if (!db) throw new Error("Database not initialized");
  db.exec("COMMIT");
  inTransaction = false;
  saveDatabase();
}

export function rollbackTransaction(): void {
  if (!db) throw new Error("Database not initialized");
  db.exec("ROLLBACK");
  inTransaction = false;
}

export function addAuditLog(
  entityType: string,
  entityId: number,
  field: string,
  oldValue: string | null,
  newValue: string | null,
  changedBy: string,
): void {
  if (!db) return;
  const now = getUtcNow();
  db.run(
    "INSERT INTO audit_log (entity_type, entity_id, field, old_value, new_value, changed_by, changed_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [entityType, entityId, field, oldValue, newValue, changedBy, now] as BindParams,
  );
  if (!inTransaction) saveDatabase();
}

export function logSystemEvent(event_type: string, details: string, stationId: number): void {
  if (!db) return;
  const stmt = db.prepare(
    "INSERT INTO system_events (event_type, details, station_id, timestamp) VALUES (?, ?, ?, ?)",
  );
  stmt.run([event_type, details, stationId || 1, getUtcNow()] as BindParams);
  stmt.free();
  if (!inTransaction) saveDatabase();
}

export function verifySession(sessionId: string): { userId: number; role: UserRole } | null {
  if (!sessionId) return null;
  const session = runOne(
    "SELECT user_id FROM user_sessions WHERE session_id = ? AND expires_at > ?",
    [sessionId, getUtcNow()] as BindParams,
  );
  if (!session) return null;
  const userId = session[0] as number;
  const user = runOne("SELECT id, role FROM users WHERE id = ? AND is_active = 1", [
    userId,
  ] as BindParams);
  if (!user) return null;
  return { userId, role: user[1] as UserRole };
}

export function requireAuth(
  sessionId: string,
  allowedRoles: UserRole[],
): { userId: number; role: UserRole } | null {
  const session = verifySession(sessionId);
  if (!session) return null;
  if (!allowedRoles.includes(session.role)) return null;
  return session;
}

export function rowToService(row: SqlValue[]): ServiceRecord {
  return {
    id: row[0] as number,
    name: row[1] as string,
    description: row[2] as string,
    price: row[3] as number,
    isDeleted: row[4] === 1,
    createdAt: row[5] as string,
    updatedAt: row[6] as string,
  };
}

export function rowToProduct(row: SqlValue[]): ProductRecord {
  return {
    id: row[0] as number,
    name: row[1] as string,
    price: row[2] as number,
    costPrice: row[3] as number,
    quantity: row[4] as number,
    lowStockThreshold: row[5] as number,
    isDeleted: row[6] === 1,
    createdAt: row[7] as string,
    updatedAt: row[8] as string,
  };
}

export function rowToCategory(row: SqlValue[]): CategoryRecord {
  return {
    id: row[0] as number,
    name: row[1] as string,
    isDeleted: row[2] === 1,
    createdAt: row[3] as string,
  };
}

export function rowToExpense(row: SqlValue[]): ExpenseRecord {
  return {
    id: row[0] as number,
    category: row[1] as string,
    amount: row[2] as number,
    description: row[3] as string,
    isDeleted: row[4] === 1,
    createdAt: row[5] as string,
    updatedAt: row[6] as string,
  };
}

export function rowToAuditEntry(row: SqlValue[]): AuditEntry {
  return {
    id: row[0] as number,
    entityType: row[1] as string,
    entityId: row[2] as number,
    field: row[3] as string,
    oldValue: row[4] === null ? "" : String(row[4]),
    newValue: row[5] === null ? "" : String(row[5]),
    changedBy: row[6] as string,
    changedAt: row[7] as string,
  };
}

export function rowToEvent(row: SqlValue[]): EventRecord {
  return {
    id: row[0] as number,
    eventType: row[1] as string,
    details: row[2] as string,
    stationId: row[3] as number,
    timestamp: row[4] as string,
  };
}

export function rowToCommissionRate(row: SqlValue[]): CommissionRateRecord {
  return {
    id: row[0] as number,
    barberId: row[1] as number,
    rate: row[2] as number,
    effectiveFrom: row[3] as string,
    isDeleted: row[4] === 1,
    createdAt: row[5] as string,
  };
}

export function rowToSale(row: SqlValue[]): SaleRecord {
  return {
    id: row[0] as number,
    barberId: row[1] as number,
    stationId: row[2] as number,
    totalAmount: row[3] as number,
    cashAmount: row[4] as number,
    isDeleted: row[5] === 1,
    createdAt: row[6] as string,
    createdBy: row[7] as number,
  };
}

export function rowToDailyClosing(row: SqlValue[]): DailyClosingRecord {
  return {
    id: row[0] as number,
    businessDate: row[1] as string,
    stationId: row[2] as number,
    expectedCash: row[3] as number,
    countedCash: row[4] as number,
    difference: row[5] as number,
    expenseTotal: row[6] as number,
    closedBy: row[7] as number,
    closedAt: row[8] as string,
  };
}

export function mapDailyClosings(rows: SqlValue[][]): DailyClosingRecord[] {
  return rows.map(rowToDailyClosing);
}

export function mapServices(rows: SqlValue[][]): ServiceRecord[] {
  return rows.map(rowToService);
}

export function mapProducts(rows: SqlValue[][]): ProductRecord[] {
  return rows.map(rowToProduct);
}

export function mapCategories(rows: SqlValue[][]): CategoryRecord[] {
  return rows.map(rowToCategory);
}

export function mapExpenses(rows: SqlValue[][]): ExpenseRecord[] {
  return rows.map(rowToExpense);
}

export function mapAuditEntries(rows: SqlValue[][]): AuditEntry[] {
  return rows.map(rowToAuditEntry);
}

export function mapEvents(rows: SqlValue[][]): EventRecord[] {
  return rows.map(rowToEvent);
}

export function mapSales(rows: SqlValue[][]): SaleRecord[] {
  return rows.map(rowToSale);
}

export function saveDatabase(): void {
  if (inTransaction) return;
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(getDatabasePath(), buffer);
  }
}

export async function initializeDatabase(): Promise<void> {
  const sqlModule = await initSqlJs({ locateFile: () => path.join(__dirname, "sql-wasm.wasm") });
  SQL = sqlModule as SqlJsStatic;
  const dbPath = getDatabasePath();

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(new Uint8Array(fileBuffer));
  } else {
    db = new SQL.Database();
    runMigrations();
    seedDefaultUser();
    saveDatabase();
  }
}

export function runMigrations(): void {
  if (!db) return;

  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);

  const appliedResult = db.exec("SELECT name FROM _migrations");
  const applied = new Set(appliedResult[0]?.values.map((v: SqlValue[]) => v[0]) || []);

  if (!applied.has("001_initial")) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        role TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'barber')),
        password_hash TEXT,
        pin_hash TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS services (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        price INTEGER NOT NULL,
        is_deleted INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        price INTEGER NOT NULL,
        cost_price INTEGER NOT NULL DEFAULT 0,
        quantity INTEGER NOT NULL DEFAULT 0,
        low_stock_threshold INTEGER NOT NULL DEFAULT 5,
        is_deleted INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS expense_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        is_deleted INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL,
        amount INTEGER NOT NULL,
        description TEXT,
        is_deleted INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        barber_id INTEGER NOT NULL,
        station_id INTEGER NOT NULL,
        total_amount INTEGER NOT NULL,
        cash_amount INTEGER NOT NULL,
        is_deleted INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        created_by INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sale_service_lines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_id INTEGER NOT NULL,
        service_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        price INTEGER NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        line_total INTEGER NOT NULL,
        FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS sale_product_lines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        price INTEGER NOT NULL,
        cost_price INTEGER NOT NULL DEFAULT 0,
        quantity INTEGER NOT NULL DEFAULT 1,
        line_total INTEGER NOT NULL,
        FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS commission_rates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        barber_id INTEGER NOT NULL,
        rate INTEGER NOT NULL,
        effective_from TEXT NOT NULL,
        is_deleted INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        FOREIGN KEY (barber_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL,
        entity_id INTEGER NOT NULL,
        field TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT,
        changed_by TEXT NOT NULL,
        changed_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS system_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type TEXT NOT NULL,
        details TEXT,
        station_id INTEGER,
        timestamp TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS user_sessions (
        session_id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        station_id INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    const now = getUtcNow();
    db.run(
      `INSERT OR IGNORE INTO expense_categories (name, is_deleted, created_at) VALUES
        ('Rent', 0, ?),
        ('Utilities', 0, ?),
        ('Salaries', 0, ?),
        ('Supplies & consumables', 0, ?),
        ('Maintenance', 0, ?),
        ('Marketing', 0, ?),
        ('Miscellaneous', 0, ?)`,
      [now, now, now, now, now, now, now] as BindParams,
    );

    db.run("INSERT INTO _migrations (name, applied_at) VALUES (?, ?)", [
      "001_initial",
      now,
    ] as BindParams);
  }

  if (!applied.has("002_phase3_schema")) {
    try {
      db.run("ALTER TABLE services ADD COLUMN description TEXT");
    } catch {
      // Column may already exist; ignore
    }

    try {
      db.run("ALTER TABLE products ADD COLUMN cost_price INTEGER NOT NULL DEFAULT 0");
    } catch {
      // Column may already exist; ignore
    }

    db.run("INSERT INTO _migrations (name, applied_at) VALUES (?, ?)", [
      "002_phase3_schema",
      getUtcNow(),
    ] as BindParams);
  }

  if (!applied.has("003_phase8_eod")) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS daily_closings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        business_date TEXT NOT NULL,
        station_id INTEGER NOT NULL DEFAULT 1,
        expected_cash INTEGER NOT NULL DEFAULT 0,
        counted_cash INTEGER NOT NULL DEFAULT 0,
        difference INTEGER NOT NULL DEFAULT 0,
        expense_total INTEGER NOT NULL DEFAULT 0,
        closed_by INTEGER NOT NULL,
        closed_at TEXT NOT NULL,
        UNIQUE (business_date, station_id)
      );
    `);

    db.run("INSERT INTO _migrations (name, applied_at) VALUES (?, ?)", [
      "003_phase8_eod",
      getUtcNow(),
    ] as BindParams);
  }
}

export function seedDefaultUser(): void {
  if (!db) return;
  const existing = db.exec("SELECT id FROM users WHERE role = 'owner'")[0]?.values[0];
  if (!existing) {
    return;
  }
}
