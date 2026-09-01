import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { getDatabasePath } from './paths';
import * as fs from 'fs';
import initSqlJs, { Database, SqlValue, BindParams, SqlJsStatic } from 'sql.js';
import bcrypt from 'bcrypt';

type UserRole = 'owner' | 'manager' | 'barber';

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

let mainWindow: BrowserWindow | null = null;
let db: Database | null = null;
let SQL: SqlJsStatic | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'Barbershop Management',
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/renderer/index.html'));
  }
}

function getUtcNow(): string {
  return new Date().toISOString();
}

async function initializeDatabase(): Promise<void> {
  const sqlModule = await initSqlJs({ locateFile: () => path.join(__dirname, 'sql-wasm.wasm') });
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

function saveDatabase(): void {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(getDatabasePath(), buffer);
  }
}

function runMigrations(): void {
  if (!db) return;

  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);

  const appliedResult = db.exec('SELECT name FROM _migrations');
  const applied = new Set(appliedResult[0]?.values.map((v: SqlValue[]) => v[0]) || []);

  if (!applied.has('001_initial')) {
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
      [now, now, now, now, now, now, now] as BindParams
    );
    
    db.run('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)', ['001_initial', now] as BindParams);
  }

  if (!applied.has('002_phase3_schema')) {
    // Add description to services
    try {
      db.run('ALTER TABLE services ADD COLUMN description TEXT');
    } catch {}

    // Add cost_price to products
    try {
      db.run('ALTER TABLE products ADD COLUMN cost_price INTEGER NOT NULL DEFAULT 0');
    } catch {}

    db.run('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)', ['002_phase3_schema', getUtcNow()] as BindParams);
  }
}

function seedDefaultUser(): void {
  if (!db) return;
  const existing = db.exec("SELECT id FROM users WHERE role = 'owner'")[0]?.values[0];
  if (!existing) {
    return;
  }
}

function runQuery(sql: string, params: BindParams = []): SqlValue[][] {
  if (!db) throw new Error('Database not initialized');
  const result = db.exec(sql, params);
  return result[0]?.values || [];
}

function runOne(sql: string, params: BindParams = []): SqlValue[] | undefined {
  const rows = runQuery(sql, params);
  return rows[0];
}

function runSql(sql: string, params: BindParams = []): { changes: number; lastInsertRowid: number } {
  if (!db) throw new Error('Database not initialized');
  db.run(sql, params);
  saveDatabase();
  const lastIdResult = db.exec('SELECT last_insert_rowid()');
  const lastId = lastIdResult[0]?.values[0]?.[0] as number || 0;
  return { changes: db.getRowsModified(), lastInsertRowid: lastId };
}

function verifySession(sessionId: string): { userId: number; role: UserRole } | null {
  if (!sessionId) return null;
  const session = runOne(
    'SELECT user_id FROM user_sessions WHERE session_id = ? AND expires_at > ?',
    [sessionId, getUtcNow()] as BindParams
  );
  if (!session) return null;
  const userId = session[0] as number;
  const user = runOne('SELECT id, role FROM users WHERE id = ? AND is_active = 1', [userId] as BindParams);
  if (!user) return null;
  return { userId, role: user[1] as UserRole };
}

function requireAuth(
  sessionId: string,
  allowedRoles: UserRole[],
): { userId: number; role: UserRole } | null {
  const session = verifySession(sessionId);
  if (!session) return null;
  if (!allowedRoles.includes(session.role)) return null;
  return session;
}

function addAuditLog(
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
    'INSERT INTO audit_log (entity_type, entity_id, field, old_value, new_value, changed_by, changed_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [entityType, entityId, field, oldValue, newValue, changedBy, now] as BindParams
  );
  saveDatabase();
}

function logSystemEvent(
  event_type: string,
  details: string,
  stationId: number,
): void {
  if (!db) return;
  const stmt = db.prepare(
    'INSERT INTO system_events (event_type, details, station_id, timestamp) VALUES (?, ?, ?, ?)'
  );
  stmt.run([event_type, details, stationId || 1, getUtcNow()] as BindParams);
  stmt.free();
  saveDatabase();
}

function rowToService(row: SqlValue[]): ServiceRecord {
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

function rowToProduct(row: SqlValue[]): ProductRecord {
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

function rowToCategory(row: SqlValue[]): CategoryRecord {
  return {
    id: row[0] as number,
    name: row[1] as string,
    isDeleted: row[2] === 1,
    createdAt: row[3] as string,
  };
}

function rowToExpense(row: SqlValue[]): ExpenseRecord {
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

function rowToAuditEntry(row: SqlValue[]): AuditEntry {
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

function rowToEvent(row: SqlValue[]): EventRecord {
  return {
    id: row[0] as number,
    eventType: row[1] as string,
    details: row[2] as string,
    stationId: row[3] as number,
    timestamp: row[4] as string,
  };
}

function rowToCommissionRate(row: SqlValue[]): CommissionRateRecord {
  return {
    id: row[0] as number,
    barberId: row[1] as number,
    rate: row[2] as number,
    effectiveFrom: row[3] as string,
    isDeleted: row[4] === 1,
    createdAt: row[5] as string,
  };
}

function rowToSale(row: SqlValue[]): SaleRecord {
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

function mapServices(rows: SqlValue[][]): ServiceRecord[] {
  return rows.map(rowToService);
}

function mapProducts(rows: SqlValue[][]): ProductRecord[] {
  return rows.map(rowToProduct);
}

function mapCategories(rows: SqlValue[][]): CategoryRecord[] {
  return rows.map(rowToCategory);
}

function mapExpenses(rows: SqlValue[][]): ExpenseRecord[] {
  return rows.map(rowToExpense);
}

function mapAuditEntries(rows: SqlValue[][]): AuditEntry[] {
  return rows.map(rowToAuditEntry);
}

function mapEvents(rows: SqlValue[][]): EventRecord[] {
  return rows.map(rowToEvent);
}

function mapSales(rows: SqlValue[][]): SaleRecord[] {
  return rows.map(rowToSale);
}

function setupIPC(): void {
  const database = db;
  if (!database) throw new Error('Database not initialized');

  ipcMain.handle('get-db-path', () => getDatabasePath());

  // Authentication IPC handlers
  ipcMain.handle('auth:login', async (_event, username: string, password: string, stationId: number) => {
    try {
      const user = runOne('SELECT * FROM users WHERE username = ? AND is_active = 1', [username] as BindParams);
      if (!user) {
        logSystemEvent('login_failed', `Failed login attempt for username: ${username}`, stationId || 1);
        return { success: false, error: 'Invalid credentials' };
      }

      const passwordHash = user[3] as string | null;
      if (!passwordHash) {
        logSystemEvent('login_failed', `No password set for user: ${username}`, stationId || 1);
        return { success: false, error: 'No password set for this account' };
      }

      const isValid = bcrypt.compareSync(password, passwordHash);
      if (!isValid) {
        logSystemEvent('login_failed', `Invalid password for user: ${username}`, stationId || 1);
        return { success: false, error: 'Invalid credentials' };
      }

      const userId = user[0] as number;
      const role = user[2] as UserRole;
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      database.run(
        'INSERT INTO user_sessions (session_id, user_id, station_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?)',
        [sessionId, userId, stationId || 1, getUtcNow(), new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()] as BindParams
      );
      saveDatabase();

      logSystemEvent('login_success', `User ${username} logged in`, stationId || 1);

      return { success: true, user: { id: userId, username: user[1] as string, role }, sessionId };
    } catch (error) {
      return { success: false, error: 'Authentication failed' };
    }
  });

  ipcMain.handle('auth:loginPin', async (_event, pin: string, stationId: number) => {
    try {
      const users = runQuery('SELECT * FROM users WHERE role = ? AND is_active = 1', ['barber'] as BindParams);
      let matchedUser: SqlValue[] | null = null;

      for (const user of users) {
        const pinHash = user[4] as string | null;
        if (pinHash && bcrypt.compareSync(pin, pinHash)) {
          matchedUser = user;
          break;
        }
      }

      if (!matchedUser) {
        logSystemEvent('login_failed', `Invalid PIN attempt`, stationId || 1);
        return { success: false, error: 'Invalid PIN' };
      }

      const userId = matchedUser[0] as number;
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      database.run(
        'INSERT INTO user_sessions (session_id, user_id, station_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?)',
        [sessionId, userId, stationId || 1, getUtcNow(), new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()] as BindParams
      );
      saveDatabase();

      logSystemEvent('login_success', `Barber ${matchedUser[1]} logged in via PIN`, stationId || 1);

      return { success: true, user: { id: userId, username: matchedUser[1] as string, role: 'barber' as const }, sessionId };
    } catch (error) {
      return { success: false, error: 'Authentication failed' };
    }
  });

  ipcMain.handle('auth:logout', async (_event, sessionId: string) => {
    try {
      if (sessionId) {
        database.run('DELETE FROM user_sessions WHERE session_id = ?', [sessionId] as BindParams);
        saveDatabase();
        logSystemEvent('logout', `Session ${sessionId} logged out`, 1);
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Logout failed' };
    }
  });

  ipcMain.handle('auth:verifySession', async (_event, sessionId: string) => {
    try {
      if (!sessionId) return { valid: false };
      const session = runOne('SELECT * FROM user_sessions WHERE session_id = ? AND expires_at > ?', [sessionId, getUtcNow()] as BindParams);
      if (!session) return { valid: false };
      const user = runOne('SELECT id, username, role FROM users WHERE id = ? AND is_active = 1', [session[1]] as BindParams);
      if (!user) return { valid: false };
      return { valid: true, user: { id: user[0] as number, username: user[1] as string, role: user[2] as UserRole } };
    } catch (error) {
      return { valid: false };
    }
  });

  ipcMain.handle('auth:getCurrentUser', async (_event, sessionId: string) => {
    try {
      if (!sessionId) return { user: null };
      const session = runOne('SELECT * FROM user_sessions WHERE session_id = ? AND expires_at > ?', [sessionId, getUtcNow()] as BindParams);
      if (!session) return { user: null };
      const user = runOne('SELECT id, username, role FROM users WHERE id = ? AND is_active = 1', [session[1]] as BindParams);
      if (!user) return { user: null };
      return { user: { id: user[0] as number, username: user[1] as string, role: user[2] as UserRole } };
    } catch (error) {
      return { user: null };
    }
  });

  ipcMain.handle('auth:changePassword', async (_event, sessionId: string, oldPassword: string, newPassword: string) => {
    try {
      const session = verifySession(sessionId);
      if (!session) return { success: false, error: 'Invalid session' };

      const userId = session.userId;
      const user = runOne('SELECT * FROM users WHERE id = ?', [userId] as BindParams);
      if (!user) return { success: false, error: 'User not found' };

      const passwordHash = user[3] as string | null;
      if (!passwordHash || !bcrypt.compareSync(oldPassword, passwordHash)) {
        return { success: false, error: 'Current password is incorrect' };
      }

      const newPasswordHash = bcrypt.hashSync(newPassword, 10);
      database.run('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', [newPasswordHash, getUtcNow(), userId] as BindParams);
      saveDatabase();

      logSystemEvent('password_changed', `Password changed for user ${user[1]}`, 1);

      return { success: true };
    } catch (error) {
      return { success: false, error: 'Failed to change password' };
    }
  });

  ipcMain.handle('auth:setPin', async (_event, sessionId: string, pin: string) => {
    try {
      const session = verifySession(sessionId);
      if (!session) return { success: false, error: 'Invalid session' };

      const userId = session.userId;
      const pinHash = bcrypt.hashSync(pin, 10);
      const existingPin = runOne('SELECT id FROM users WHERE role = ? AND pin_hash = ? AND is_active = 1 AND id != ?', ['barber', pinHash, userId] as BindParams);
      if (existingPin) {
        return { success: false, error: 'PIN already in use by another active barber' };
      }
      database.run('UPDATE users SET pin_hash = ?, updated_at = ? WHERE id = ?', [pinHash, getUtcNow(), userId] as BindParams);
      saveDatabase();

      return { success: true };
    } catch (error) {
      return { success: false, error: 'Failed to set PIN' };
    }
  });

  ipcMain.handle('auth:createUser', async (_event, sessionId: string, username: string, role: UserRole, password?: string, pin?: string) => {
    try {
      const session = requireAuth(sessionId, ['owner']);
      if (!session) return { success: false, error: 'Only owner can create users' };

      if (role === 'owner') {
        return { success: false, error: 'Cannot create another owner' };
      }

      const now = getUtcNow();
      const passwordHash = password ? bcrypt.hashSync(password, 10) : null;
      const pinHash = pin ? bcrypt.hashSync(pin, 10) : null;
      if (role === 'barber' && pinHash) {
        const existingPin = runOne('SELECT id FROM users WHERE role = ? AND pin_hash = ? AND is_active = 1', ['barber', pinHash] as BindParams);
        if (existingPin) {
          return { success: false, error: 'PIN already in use by another active barber' };
        }
      }

      const result = runSql(
        'INSERT INTO users (username, role, password_hash, pin_hash, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [username, role, passwordHash, pinHash, 1, now, now] as BindParams
      );

      logSystemEvent('user_created', `User ${username} created with role ${role}`, 1);

      return { success: true, userId: result.lastInsertRowid };
    } catch (error) {
      return { success: false, error: 'Failed to create user' };
    }
  });

  ipcMain.handle('auth:deactivateUser', async (_event, sessionId: string, userId: number) => {
    try {
      const session = requireAuth(sessionId, ['owner']);
      if (!session) return { success: false, error: 'Only owner can deactivate users' };

      if (userId === session.userId) {
        return { success: false, error: 'Cannot deactivate yourself' };
      }

      const targetUser = runOne('SELECT role FROM users WHERE id = ?', [userId] as BindParams);
      if (!targetUser) return { success: false, error: 'User not found' };
      if (targetUser[0] === 'owner') return { success: false, error: 'Cannot deactivate owner' };

      database.run('UPDATE users SET is_active = 0, updated_at = ? WHERE id = ?', [getUtcNow(), userId] as BindParams);
      database.run('DELETE FROM user_sessions WHERE user_id = ?', [userId] as BindParams);
      saveDatabase();

      logSystemEvent('user_deactivated', `User id ${userId} deactivated`, 1);

      return { success: true };
    } catch (error) {
      return { success: false, error: 'Failed to deactivate user' };
    }
  });

  ipcMain.handle('auth:listUsers', async (_event, sessionId: string) => {
    try {
      const session = requireAuth(sessionId, ['owner']);
      if (!session) return { users: [] };

      const users = runQuery('SELECT id, username, role, is_active, created_at FROM users ORDER BY id');
      return { users: users.map(u => ({ id: u[0] as number, username: u[1] as string, role: u[2] as string, isActive: u[3] as number, createdAt: u[4] as string })) };
    } catch (error) {
      return { users: [] };
    }
  });

  // First-run setup - no auth required (only works if no Owner exists)
  ipcMain.handle('auth:checkOwnerExists', async () => {
    try {
      const existing = runOne("SELECT id FROM users WHERE role = 'owner' AND is_active = 1");
      return { exists: !!existing };
    } catch (error) {
      return { exists: false };
    }
  });

  ipcMain.handle('auth:firstRunSetup', async (_event, username: string, password: string) => {
    try {
      const existing = runOne("SELECT id FROM users WHERE role = 'owner' AND is_active = 1");
      if (existing) {
        return { success: false, error: 'Owner already exists' };
      }

      if (!username || !password) {
        return { success: false, error: 'Username and password are required' };
      }

      if (password.length < 8) {
        return { success: false, error: 'Password must be at least 8 characters' };
      }

      const passwordHash = bcrypt.hashSync(password, 10);
      const now = getUtcNow();

      const result = runSql(
        'INSERT INTO users (username, role, password_hash, pin_hash, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        ['owner', 'owner', passwordHash, null, 1, now, now] as BindParams
      );

      logSystemEvent('first_run_setup', `First Owner account created: ${username}`, 1);

      return { success: true, userId: result.lastInsertRowid };
    } catch (error) {
      return { success: false, error: 'Failed to create Owner account' };
    }
  });

  // System event logging (requires valid session)
  ipcMain.handle('log-event', (_event, sessionId: string, eventType: string, details: string, stationId?: number) => {
    const session = verifySession(sessionId);
    if (!session) return;
    logSystemEvent(eventType, details, stationId || 1);
  });

  ipcMain.handle('get-events', (_event, sessionId: string, limit: number, offset: number) => {
    const session = verifySession(sessionId);
    if (!session) return [];
    return mapEvents(runQuery('SELECT * FROM system_events ORDER BY timestamp DESC LIMIT ? OFFSET ?', [limit, offset] as BindParams));
  });

  // Service IPC handlers (owner or manager)
  ipcMain.handle('services:getAll', async (_event, sessionId: string, limit = 100, offset = 0, includeDeleted = false) => {
    const session = requireAuth(sessionId, ['owner', 'manager']);
    if (!session) return [];
    const whereClause = includeDeleted ? "" : "WHERE is_deleted = 0";
    return mapServices(runQuery(`SELECT * FROM services ${whereClause} ORDER BY name LIMIT ? OFFSET ?`, [limit, offset] as BindParams));
  });

  ipcMain.handle('services:getById', async (_event, sessionId: string, id: number) => {
    const session = requireAuth(sessionId, ['owner', 'manager']);
    if (!session) return undefined;
    const row = runOne("SELECT * FROM services WHERE id = ?", [id] as BindParams);
    return row ? rowToService(row) : undefined;
  });

  ipcMain.handle('services:getActive', async (_event, sessionId: string) => {
    const session = requireAuth(sessionId, ['owner', 'manager']);
    if (!session) return [];
    return mapServices(runQuery('SELECT * FROM services WHERE is_deleted = 0 ORDER BY name'));
  });

  ipcMain.handle('services:create', async (_event, sessionId: string, name: string, description: string, price: number) => {
    const session = requireAuth(sessionId, ['owner', 'manager']);
    if (!session) return { success: false, error: 'Unauthorized' };

    if (!name || !name.trim()) {
      return { success: false, error: 'Service name is required' };
    }
    if (price < 0) {
      return { success: false, error: 'Price cannot be negative' };
    }

    const now = getUtcNow();
    const result = runSql(
      'INSERT INTO services (name, description, price, is_deleted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [name.trim(), description?.trim() || "", price, 0, now, now] as BindParams
    );

    addAuditLog('services', result.lastInsertRowid, 'name', null, name.trim(), `user:${session.userId}`);
    addAuditLog('services', result.lastInsertRowid, 'description', null, description?.trim() || "", `user:${session.userId}`);
    addAuditLog('services', result.lastInsertRowid, 'price', null, String(price), `user:${session.userId}`);
    logSystemEvent('service_created', `Service created: ${name.trim()} (${price} IQD)`, 1);

    return { success: true, id: result.lastInsertRowid };
  });

  ipcMain.handle('services:update', async (_event, sessionId: string, id: number, name: string, description: string, price: number) => {
    const session = requireAuth(sessionId, ['owner', 'manager']);
    if (!session) return { success: false, error: 'Unauthorized' };

    if (!name || !name.trim()) {
      return { success: false, error: 'Service name is required' };
    }
    if (price < 0) {
      return { success: false, error: 'Price cannot be negative' };
    }

    const oldService = runOne("SELECT * FROM services WHERE id = ?", [id] as BindParams);
    if (!oldService) {
      return { success: false, error: 'Service not found' };
    }

    const result = runSql(
      'UPDATE services SET name = ?, description = ?, price = ?, updated_at = ? WHERE id = ?',
      [name.trim(), description?.trim() || "", price, getUtcNow(), id] as BindParams
    );

    const oldName = oldService[1] as string;
    const oldDesc = oldService[2] as string | null;
    const oldPrice = oldService[3] as number;
    addAuditLog('services', id, 'name', oldName, name.trim(), `user:${session.userId}`);
    addAuditLog('services', id, 'description', oldDesc, description?.trim() || "", `user:${session.userId}`);
    addAuditLog('services', id, 'price', String(oldPrice), String(price), `user:${session.userId}`);

    return { success: true, changes: result.changes };
  });

  ipcMain.handle('services:delete', async (_event, sessionId: string, id: number) => {
    const session = requireAuth(sessionId, ['owner', 'manager']);
    if (!session) return { success: false, error: 'Unauthorized' };

    const oldService = runOne("SELECT * FROM services WHERE id = ?", [id] as BindParams);
    if (!oldService) {
      return { success: false, error: 'Service not found' };
    }

    const result = runSql('UPDATE services SET is_deleted = 1 WHERE id = ?', [id] as BindParams);

    addAuditLog('services', id, 'is_deleted', '0', '1', `user:${session.userId}`);
    logSystemEvent('service_deleted', `Service deleted: ${oldService[1] as string}`, 1);

    return { success: true, changes: result.changes };
  });

  // Product IPC handlers (owner or manager)
  ipcMain.handle('products:getAll', async (_event, sessionId: string, limit = 100, offset = 0, includeDeleted = false) => {
    const session = requireAuth(sessionId, ['owner', 'manager']);
    if (!session) return [];
    const whereClause = includeDeleted ? "" : "WHERE is_deleted = 0";
    return mapProducts(runQuery(`SELECT * FROM products ${whereClause} ORDER BY name LIMIT ? OFFSET ?`, [limit, offset] as BindParams));
  });

   ipcMain.handle('products:getLowStock', async (_event, sessionId: string) => {
    const session = requireAuth(sessionId, ['owner', 'manager']);
    if (!session) return [];
    return mapProducts(runQuery('SELECT * FROM products WHERE quantity < low_stock_threshold AND is_deleted = 0'));
  });

  ipcMain.handle('products:getById', async (_event, sessionId: string, id: number) => {
    const session = requireAuth(sessionId, ['owner', 'manager']);
    if (!session) return undefined;
    const row = runOne("SELECT * FROM products WHERE id = ?", [id] as BindParams);
    return row ? rowToProduct(row) : undefined;
  });

  ipcMain.handle('products:getActive', async (_event, sessionId: string) => {
    const session = requireAuth(sessionId, ['owner', 'manager']);
    if (!session) return [];
    return mapProducts(runQuery('SELECT * FROM products WHERE is_deleted = 0 ORDER BY name'));
  });

  ipcMain.handle('products:getLowStockCount', async (_event, sessionId: string) => {
    const session = requireAuth(sessionId, ['owner', 'manager']);
    if (!session) return 0;
     const result = runQuery('SELECT COUNT(*) as count FROM products WHERE quantity < low_stock_threshold AND is_deleted = 0');
    return (result[0]?.[0] as number) || 0;
  });

  ipcMain.handle('products:create', async (_event, sessionId: string, name: string, price: number, costPrice: number, quantity: number, lowStockThreshold: number) => {
    const session = requireAuth(sessionId, ['owner', 'manager']);
    if (!session) return { success: false, error: 'Unauthorized' };

    if (!name || !name.trim()) {
      return { success: false, error: 'Product name is required' };
    }
    if (price < 0) {
      return { success: false, error: 'Selling price cannot be negative' };
    }
    if (costPrice < 0) {
      return { success: false, error: 'Cost price cannot be negative' };
    }
    if (quantity < 0) {
      return { success: false, error: 'Quantity cannot be negative' };
    }
    if (lowStockThreshold < 0) {
      return { success: false, error: 'Low stock threshold cannot be negative' };
    }

    const now = getUtcNow();
    const result = runSql(
      'INSERT INTO products (name, price, cost_price, quantity, low_stock_threshold, is_deleted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [name.trim(), price, costPrice, quantity, lowStockThreshold, 0, now, now] as BindParams
    );

    addAuditLog('products', result.lastInsertRowid, 'name', null, name.trim(), `user:${session.userId}`);
    addAuditLog('products', result.lastInsertRowid, 'price', null, String(price), `user:${session.userId}`);
    addAuditLog('products', result.lastInsertRowid, 'cost_price', null, String(costPrice), `user:${session.userId}`);
    addAuditLog('products', result.lastInsertRowid, 'quantity', null, String(quantity), `user:${session.userId}`);
    addAuditLog('products', result.lastInsertRowid, 'low_stock_threshold', null, String(lowStockThreshold), `user:${session.userId}`);

    return { success: true, id: result.lastInsertRowid };
  });

  ipcMain.handle('products:update', async (_event, sessionId: string, id: number, name: string, price: number, costPrice: number, quantity: number, lowStockThreshold: number) => {
    const session = requireAuth(sessionId, ['owner', 'manager']);
    if (!session) return { success: false, error: 'Unauthorized' };

    if (!name || !name.trim()) {
      return { success: false, error: 'Product name is required' };
    }
    if (price < 0) {
      return { success: false, error: 'Selling price cannot be negative' };
    }
    if (costPrice < 0) {
      return { success: false, error: 'Cost price cannot be negative' };
    }
    if (quantity < 0) {
      return { success: false, error: 'Quantity cannot be negative' };
    }
    if (lowStockThreshold < 0) {
      return { success: false, error: 'Low stock threshold cannot be negative' };
    }

    const oldProduct = runOne("SELECT * FROM products WHERE id = ?", [id] as BindParams);
    if (!oldProduct) {
      return { success: false, error: 'Product not found' };
    }

    const result = runSql(
      'UPDATE products SET name = ?, price = ?, cost_price = ?, quantity = ?, low_stock_threshold = ?, updated_at = ? WHERE id = ?',
      [name.trim(), price, costPrice, quantity, lowStockThreshold, getUtcNow(), id] as BindParams
    );

    const oldName = oldProduct[1] as string;
    const oldPrice = oldProduct[2] as number;
    const oldCost = oldProduct[3] as number;
    const oldQty = oldProduct[4] as number;
    const oldThreshold = oldProduct[5] as number;
    addAuditLog('products', id, 'name', oldName, name.trim(), `user:${session.userId}`);
    addAuditLog('products', id, 'price', String(oldPrice), String(price), `user:${session.userId}`);
    addAuditLog('products', id, 'cost_price', String(oldCost), String(costPrice), `user:${session.userId}`);
    addAuditLog('products', id, 'quantity', String(oldQty), String(quantity), `user:${session.userId}`);
    addAuditLog('products', id, 'low_stock_threshold', String(oldThreshold), String(lowStockThreshold), `user:${session.userId}`);

    return { success: true, changes: result.changes };
  });

  ipcMain.handle('products:delete', async (_event, sessionId: string, id: number) => {
    const session = requireAuth(sessionId, ['owner', 'manager']);
    if (!session) return { success: false, error: 'Unauthorized' };

    const oldProduct = runOne("SELECT * FROM products WHERE id = ?", [id] as BindParams);
    if (!oldProduct) {
      return { success: false, error: 'Product not found' };
    }

    const result = runSql('UPDATE products SET is_deleted = 1 WHERE id = ?', [id] as BindParams);

    addAuditLog('products', id, 'is_deleted', '0', '1', `user:${session.userId}`);

    return { success: true, changes: result.changes };
  });

  ipcMain.handle('products:updateStock', async (_event, sessionId: string, productId: number, newQuantity: number) => {
    const session = requireAuth(sessionId, ['owner', 'manager']);
    if (!session) return { success: false, error: 'Unauthorized' };

    if (newQuantity < 0) {
      return { success: false, error: 'Quantity cannot be negative' };
    }

    const oldProduct = runOne("SELECT * FROM products WHERE id = ?", [productId] as BindParams);
    if (!oldProduct) {
      return { success: false, error: 'Product not found' };
    }

    const oldQty = oldProduct[4] as number;
    const result = runSql('UPDATE products SET quantity = ?, updated_at = ? WHERE id = ?', [newQuantity, getUtcNow(), productId] as BindParams);

    addAuditLog('products', productId, 'quantity', String(oldQty), String(newQuantity), `user:${session.userId}`);

    return { success: true, changes: result.changes };
  });

  ipcMain.handle('products:addStock', async (_event, sessionId: string, productId: number, quantity: number) => {
    const session = requireAuth(sessionId, ['owner', 'manager']);
    if (!session) return { success: false, error: 'Unauthorized' };

    if (quantity <= 0) {
      return { success: false, error: 'Quantity to add must be greater than zero' };
    }

    const oldProduct = runOne('SELECT * FROM products WHERE id = ?', [productId] as BindParams);
    if (!oldProduct) {
      return { success: false, error: 'Product not found' };
    }

    const oldQty = oldProduct[4] as number;
    const newQty = oldQty + quantity;
    runSql('UPDATE products SET quantity = ?, updated_at = ? WHERE id = ?', [newQty, getUtcNow(), productId] as BindParams);

    addAuditLog('products', productId, 'quantity', String(oldQty), String(newQty), `user:${session.userId}`);
    logSystemEvent('inventory_added', `Added ${quantity} to product ${oldProduct[1] as string} (qty: ${newQty})`, 1);

    return { success: true, oldQuantity: oldQty, newQuantity: newQty };
  });

  ipcMain.handle('products:removeStock', async (_event, sessionId: string, productId: number, quantity: number) => {
    const session = requireAuth(sessionId, ['owner', 'manager']);
    if (!session) return { success: false, error: 'Unauthorized' };

    if (quantity <= 0) {
      return { success: false, error: 'Quantity to remove must be greater than zero' };
    }

    const oldProduct = runOne('SELECT * FROM products WHERE id = ?', [productId] as BindParams);
    if (!oldProduct) {
      return { success: false, error: 'Product not found' };
    }

    const oldQty = oldProduct[4] as number;
    if (oldQty < quantity) {
      return { success: false, error: 'Cannot remove more stock than available' };
    }

    const newQty = oldQty - quantity;
    runSql('UPDATE products SET quantity = ?, updated_at = ? WHERE id = ?', [newQty, getUtcNow(), productId] as BindParams);

    addAuditLog('products', productId, 'quantity', String(oldQty), String(newQty), `user:${session.userId}`);
    logSystemEvent('inventory_removed', `Removed ${quantity} from product ${oldProduct[1] as string} (qty: ${newQty})`, 1);

    return { success: true, oldQuantity: oldQty, newQuantity: newQty };
  });

  // Expense Category IPC handlers (owner or manager)
  ipcMain.handle('expenseCategories:getAll', async (_event, sessionId: string, limit = 100, offset = 0, includeDeleted = false) => {
    const session = requireAuth(sessionId, ['owner', 'manager']);
    if (!session) return [];
    const whereClause = includeDeleted ? "" : "WHERE is_deleted = 0";
    return mapCategories(runQuery(`SELECT * FROM expense_categories ${whereClause} ORDER BY name LIMIT ? OFFSET ?`, [limit, offset] as BindParams));
  });

  ipcMain.handle('expenseCategories:getById', async (_event, sessionId: string, id: number) => {
    const session = requireAuth(sessionId, ['owner', 'manager']);
    if (!session) return undefined;
    const row = runOne('SELECT * FROM expense_categories WHERE id = ?', [id] as BindParams);
    return row ? rowToCategory(row) : undefined;
  });

  ipcMain.handle('expenseCategories:getActive', async (_event, sessionId: string) => {
    const session = requireAuth(sessionId, ['owner', 'manager']);
    if (!session) return [];
    return mapCategories(runQuery('SELECT * FROM expense_categories WHERE is_deleted = 0 ORDER BY name'));
  });

  ipcMain.handle('expenseCategories:create', async (_event, sessionId: string, name: string) => {
    const session = requireAuth(sessionId, ['owner', 'manager']);
    if (!session) return { success: false, error: 'Unauthorized' };

    if (!name || !name.trim()) {
      return { success: false, error: 'Category name is required' };
    }

    const result = runSql(
      'INSERT INTO expense_categories (name, is_deleted, created_at) VALUES (?, ?, ?)',
      [name.trim(), 0, getUtcNow()] as BindParams
    );

    addAuditLog('expense_categories', result.lastInsertRowid, 'name', null, name.trim(), `user:${session.userId}`);

    return { success: true, id: result.lastInsertRowid };
  });

  ipcMain.handle('expenseCategories:update', async (_event, sessionId: string, id: number, name: string) => {
    const session = requireAuth(sessionId, ['owner', 'manager']);
    if (!session) return { success: false, error: 'Unauthorized' };

    if (!name || !name.trim()) {
      return { success: false, error: 'Category name is required' };
    }

    const oldCategory = runOne('SELECT * FROM expense_categories WHERE id = ?', [id] as BindParams);
    if (!oldCategory) {
      return { success: false, error: 'Category not found' };
    }

    const result = runSql('UPDATE expense_categories SET name = ? WHERE id = ?', [name.trim(), id] as BindParams);

    addAuditLog('expense_categories', id, 'name', oldCategory[1] as string, name.trim(), `user:${session.userId}`);

    return { success: true, changes: result.changes };
  });

  ipcMain.handle('expenseCategories:delete', async (_event, sessionId: string, id: number) => {
    const session = requireAuth(sessionId, ['owner', 'manager']);
    if (!session) return { success: false, error: 'Unauthorized' };

    const oldCategory = runOne('SELECT * FROM expense_categories WHERE id = ?', [id] as BindParams);
    if (!oldCategory) {
      return { success: false, error: 'Category not found' };
    }

    const result = runSql('UPDATE expense_categories SET is_deleted = 1 WHERE id = ?', [id] as BindParams);

    addAuditLog('expense_categories', id, 'is_deleted', '0', '1', `user:${session.userId}`);

    return { success: true, changes: result.changes };
  });

  // Expense IPC handlers (owner or manager)
  ipcMain.handle('expenses:getAll', async (_event, sessionId: string, limit = 100, offset = 0, includeDeleted = false) => {
    const session = requireAuth(sessionId, ['owner', 'manager']);
    if (!session) return [];
    const whereClause = includeDeleted ? "" : "WHERE is_deleted = 0";
    return mapExpenses(runQuery(`SELECT * FROM expenses ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [limit, offset] as BindParams));
  });

  ipcMain.handle('expenses:getById', async (_event, sessionId: string, id: number) => {
    const session = requireAuth(sessionId, ['owner', 'manager']);
    if (!session) return undefined;
    const row = runOne('SELECT * FROM expenses WHERE id = ?', [id] as BindParams);
    return row ? rowToExpense(row) : undefined;
  });

  ipcMain.handle('expenses:create', async (_event, sessionId: string, category: string, amount: number, description: string) => {
    const session = requireAuth(sessionId, ['owner', 'manager']);
    if (!session) return { success: false, error: 'Unauthorized' };

    if (!category || !category.trim()) {
      return { success: false, error: 'Category is required' };
    }
    if (amount <= 0) {
      return { success: false, error: 'Amount must be greater than zero' };
    }

    const now = getUtcNow();
    const result = runSql(
      'INSERT INTO expenses (category, amount, description, is_deleted, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [category.trim(), amount, description?.trim() || "", 0, now, now] as BindParams
    );

    addAuditLog('expenses', result.lastInsertRowid, 'category', null, category.trim(), `user:${session.userId}`);
    addAuditLog('expenses', result.lastInsertRowid, 'amount', null, String(amount), `user:${session.userId}`);
    addAuditLog('expenses', result.lastInsertRowid, 'description', null, description?.trim() || "", `user:${session.userId}`);

    return { success: true, id: result.lastInsertRowid };
  });

  ipcMain.handle('expenses:update', async (_event, sessionId: string, id: number, category: string, amount: number, description: string) => {
    const session = requireAuth(sessionId, ['owner', 'manager']);
    if (!session) return { success: false, error: 'Unauthorized' };

    if (!category || !category.trim()) {
      return { success: false, error: 'Category is required' };
    }
    if (amount <= 0) {
      return { success: false, error: 'Amount must be greater than zero' };
    }

    const oldExpense = runOne('SELECT * FROM expenses WHERE id = ?', [id] as BindParams);
    if (!oldExpense) {
      return { success: false, error: 'Expense not found' };
    }

    const result = runSql(
      'UPDATE expenses SET category = ?, amount = ?, description = ?, updated_at = ? WHERE id = ?',
      [category.trim(), amount, description?.trim() || "", getUtcNow(), id] as BindParams
    );

    addAuditLog('expenses', id, 'category', oldExpense[1] as string, category.trim(), `user:${session.userId}`);
    addAuditLog('expenses', id, 'amount', String(oldExpense[2]), String(amount), `user:${session.userId}`);
    addAuditLog('expenses', id, 'description', oldExpense[3] as string | null, description?.trim() || "", `user:${session.userId}`);

    return { success: true, changes: result.changes };
  });

  ipcMain.handle('expenses:delete', async (_event, sessionId: string, id: number) => {
    const session = requireAuth(sessionId, ['owner', 'manager']);
    if (!session) return { success: false, error: 'Unauthorized' };

    const oldExpense = runOne('SELECT * FROM expenses WHERE id = ?', [id] as BindParams);
    if (!oldExpense) {
      return { success: false, error: 'Expense not found' };
    }

    const result = runSql('UPDATE expenses SET is_deleted = 1 WHERE id = ?', [id] as BindParams);

    addAuditLog('expenses', id, 'is_deleted', '0', '1', `user:${session.userId}`);

    return { success: true, changes: result.changes };
  });

  ipcMain.handle('expenses:getCategories', async (_event, sessionId: string) => {
    const session = requireAuth(sessionId, ['owner', 'manager']);
    if (!session) return [];
    return mapCategories(runQuery('SELECT * FROM expense_categories WHERE is_deleted = 0 ORDER BY name'));
  });

  // Audit Log IPC handlers (owner or manager)
  ipcMain.handle('auditLog:getAll', async (_event, sessionId: string, limit = 100, offset = 0, entityType?: string, entityId?: number) => {
    const session = requireAuth(sessionId, ['owner', 'manager']);
    if (!session) return [];

    let whereClause = "";
    const params: BindParams = [];

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
    return mapAuditEntries(runQuery(`SELECT * FROM audit_log ${whereClause} ORDER BY changed_at DESC LIMIT ? OFFSET ?`, params));
  });

  ipcMain.handle('auditLog:getByEntity', async (_event, sessionId: string, entityType: string, entityId: number) => {
    const session = requireAuth(sessionId, ['owner', 'manager']);
    if (!session) return [];
    return mapAuditEntries(
      runQuery(
        'SELECT * FROM audit_log WHERE entity_type = ? AND entity_id = ? ORDER BY changed_at DESC',
        [entityType, entityId] as BindParams
      )
    );
  });

  ipcMain.handle('auditLog:getCount', async (_event, sessionId: string, entityType?: string, entityId?: number) => {
    const session = requireAuth(sessionId, ['owner', 'manager']);
    if (!session) return 0;

    let whereClause = "";
    const params: BindParams = [];

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

    const result = runQuery(`SELECT COUNT(*) as count FROM audit_log ${whereClause}`, params);
    return (result[0]?.[0] as number) || 0;
  });

  // Commission method handlers (owner or manager — read; owner for set)
  ipcMain.handle('commission:getRate', async (_event, sessionId: string, barberId: number) => {
    const session = requireAuth(sessionId, ['owner', 'manager']);
    if (!session) return null;
    const rows = runQuery(
      'SELECT * FROM commission_rates WHERE barber_id = ? AND is_deleted = 0 ORDER BY effective_from DESC LIMIT 1',
      [barberId] as BindParams
    );
    return rows[0] ? rowToCommissionRate(rows[0]) : null;
  });

  ipcMain.handle('commission:getDues', async (_event, sessionId: string, barberId: number, startDate: string, endDate: string) => {
    const session = requireAuth(sessionId, ['owner', 'manager']);
    if (!session) return 0;
    const rows = runQuery(
      `SELECT sl.line_total, cr.rate
       FROM sales s
       JOIN sale_service_lines sl ON s.id = sl.sale_id
       JOIN commission_rates cr ON cr.barber_id = s.barber_id
       WHERE s.barber_id = ? AND s.created_at BETWEEN ? AND ? AND s.is_deleted = 0
         AND cr.effective_from = (
           SELECT MAX(cr2.effective_from)
           FROM commission_rates cr2
           WHERE cr2.barber_id = s.barber_id
             AND cr2.is_deleted = 0
             AND cr2.effective_from <= s.created_at
         )`,
      [barberId, startDate, endDate] as BindParams
    );
    let totalCommission = 0;
    for (const row of rows) {
      const lineTotal = row[0] as number;
      const rate = (row[1] as number) || 0;
      totalCommission += lineTotal * (rate / 100);
    }
    return totalCommission;
  });

  ipcMain.handle('commission:setRate', async (_event, sessionId: string, barberId: number, rate: number) => {
    const session = requireAuth(sessionId, ['owner']);
    if (!session) return { success: false, error: 'Unauthorized' };
    if (rate < 0) {
      return { success: false, error: 'Rate cannot be negative' };
    }
    const now = getUtcNow();
    runSql(
      'INSERT INTO commission_rates (barber_id, rate, effective_from, is_deleted, created_at) VALUES (?, ?, ?, ?, ?)',
      [barberId, rate, now, 0, now] as BindParams
    );
    return { success: true };
  });

  // Sales read handlers (owner or manager)
   ipcMain.handle('sales:getById', async (_event, sessionId: string, id: number) => {
    const session = requireAuth(sessionId, ['owner', 'manager']);
    if (!session) return undefined;
    const row = runOne("SELECT * FROM sales WHERE id = ? AND is_deleted = 0", [id] as BindParams);
    return row ? rowToSale(row) : undefined;
  });

  ipcMain.handle('sales:getAll', async (_event, sessionId: string, limit = 100, offset = 0) => {
    const session = requireAuth(sessionId, ['owner', 'manager']);
    if (!session) return [];
    return mapSales(runQuery(
      "SELECT * FROM sales WHERE is_deleted = 0 ORDER BY created_at DESC LIMIT ? OFFSET ?",
      [limit, offset] as BindParams
    ));
  });

  ipcMain.handle('sales:getForBarber', async (_event, sessionId: string, barberId: number, date: string) => {
    const session = requireAuth(sessionId, ['owner', 'manager']);
    if (!session) return [];
    return mapSales(runQuery(
      "SELECT * FROM sales WHERE barber_id = ? AND date(created_at) = ? AND is_deleted = 0",
      [barberId, date] as BindParams
    ));
  });

  // Sales write handlers (owner or manager)
  ipcMain.handle('sales:create', async (_event, sessionId: string, barberId: number, stationId: number, totalAmount: number, cashAmount: number, createdBy: number, lines: Array<{ type: 'service' | 'product'; itemId: number; name: string; price: number; costPrice?: number; quantity: number }>) => {
    const session = requireAuth(sessionId, ['owner', 'manager']);
    if (!session) return { success: false, error: 'Unauthorized' };

    const now = getUtcNow();
    const result = runSql(
      'INSERT INTO sales (barber_id, station_id, total_amount, cash_amount, is_deleted, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [barberId, stationId, totalAmount, cashAmount, 0, now, createdBy] as BindParams
    );
    const saleId = result.lastInsertRowid;

    for (const line of lines) {
      const lineTotal = line.price * line.quantity;
      const tableName = line.type === 'service' ? 'sale_service_lines' : 'sale_product_lines';
      const colName = line.type === 'service' ? 'service_id' : 'product_id';
      if (line.type === 'product') {
        runSql(
          `INSERT INTO ${tableName} (sale_id, ${colName}, name, price, cost_price, quantity, line_total) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [saleId, line.itemId, line.name, line.price, line.costPrice || 0, line.quantity, lineTotal] as BindParams
        );
      } else {
        runSql(
          `INSERT INTO ${tableName} (sale_id, ${colName}, name, price, quantity, line_total) VALUES (?, ?, ?, ?, ?, ?)`,
          [saleId, line.itemId, line.name, line.price, line.quantity, lineTotal] as BindParams
        );
      }
    }

    logSystemEvent('sale_created', `Sale created: ${saleId}`, stationId || 1);

    return { success: true, id: saleId };
  });

  ipcMain.handle('sales:correct', async (_event, sessionId: string, saleId: number) => {
    const session = requireAuth(sessionId, ['owner', 'manager']);
    if (!session) return { success: false, error: 'Unauthorized' };

    const sale = runOne("SELECT * FROM sales WHERE id = ?", [saleId] as BindParams);
    if (!sale || sale[5] === 1) {
      return { success: false, error: 'Sale not found' };
    }

    runSql('UPDATE sales SET is_deleted = 1 WHERE id = ?', [saleId] as BindParams);

    addAuditLog('sales', saleId, 'is_deleted', '0', '1', `user:${session.userId}`);
    logSystemEvent('sale_corrected', `Sale corrected: ${saleId}`, 1);

    return { success: true };
  });
}

app.whenReady().then(async () => {
  await initializeDatabase();
  setupIPC();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  saveDatabase();
});
