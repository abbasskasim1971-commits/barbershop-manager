import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { getDatabasePath } from './paths';
import * as fs from 'fs';
import initSqlJs, { Database, SqlValue, BindParams, SqlJsStatic } from 'sql.js';
import bcrypt from 'bcrypt';

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

function getBaghdadNow(): string {
  return new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
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
        price INTEGER NOT NULL,
        is_deleted INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        price INTEGER NOT NULL,
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
    
    const now = getBaghdadNow();
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

    db.run('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)', ['002_phase3_schema', getBaghdadNow()] as BindParams);
  }
}

function seedDefaultUser(): void {
  if (!db) return;
  const existing = db.exec("SELECT id FROM users WHERE role = 'owner'")[0]?.values[0];
  if (!existing) {
    // No default owner - first-run setup required
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
  const lastIdResult = db.exec('SELECT last_insert_rowid()');
  const lastId = lastIdResult[0]?.values[0]?.[0] as number || 0;
  return { changes: db.getRowsModified(), lastInsertRowid: lastId };
}

function setupIPC(): void {
  const database = db;
  if (!database) throw new Error('Database not initialized');

  ipcMain.handle('get-db-path', () => getDatabasePath());

  ipcMain.handle('query', (_event, sql: string, params?: unknown[]) => {
    return runQuery(sql, params as BindParams);
  });

  ipcMain.handle('get-one', (_event, sql: string, params?: unknown[]) => {
    return runOne(sql, params as BindParams);
  });

  ipcMain.handle('run-sql', (_event, sql: string, params?: unknown[]) => {
    return runSql(sql, params as BindParams);
  });

  ipcMain.handle('insert', (_event, table: string, row: Record<string, unknown>) => {
    const columns = Object.keys(row);
    const placeholders = columns.map(() => '?').join(',');
    const values = Object.values(row) as BindParams;
    const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
    return runSql(sql, values);
  });

  ipcMain.handle('update', (_event, table: string, id: number, row: Record<string, unknown>) => {
    const columns = Object.keys(row);
    const setClause = columns.map((col) => `${col} = ?`).join(', ');
    const values = [...Object.values(row), id] as BindParams;
    const sql = `UPDATE ${table} SET ${setClause} WHERE id = ?`;
    return runSql(sql, values);
  });

  ipcMain.handle('soft-delete', (_event, table: string, id: number) => {
    const sql = `UPDATE ${table} SET is_deleted = 1 WHERE id = ?`;
    return runSql(sql, [id] as BindParams);
  });

  ipcMain.handle('get-migrations', () => {
    return runQuery('SELECT name FROM _migrations');
  });

  ipcMain.handle('add-migration', (_event, name: string) => {
    runSql('INSERT OR IGNORE INTO _migrations (name, applied_at) VALUES (?, ?)', [name, getBaghdadNow()] as BindParams);
  });

  ipcMain.handle('log-event', (_event, eventType: string, details: string, stationId: number) => {
    runSql(
      'INSERT INTO system_events (event_type, details, station_id, timestamp) VALUES (?, ?, ?, ?)',
      [eventType, details, stationId || 1, getBaghdadNow()] as BindParams
    );
  });

  ipcMain.handle('get-events', (_event, limit: number, offset: number) => {
    return runQuery('SELECT * FROM system_events ORDER BY timestamp DESC LIMIT ? OFFSET ?', [limit, offset] as BindParams);
  });

  // Authentication IPC handlers
  ipcMain.handle('auth:login', async (_event, username: string, password: string, stationId: number) => {
    try {
      const user = runOne('SELECT * FROM users WHERE username = ? AND is_active = 1', [username]);
      if (!user) {
        runSql(
          'INSERT INTO system_events (event_type, details, station_id, timestamp) VALUES (?, ?, ?, ?)',
          ['login_failed', `Failed login attempt for username: ${username}`, stationId || 1, getBaghdadNow()] as BindParams
        );
        return { success: false, error: 'Invalid credentials' };
      }

      const passwordHash = user[3] as string | null;
      if (!passwordHash) {
        runSql(
          'INSERT INTO system_events (event_type, details, station_id, timestamp) VALUES (?, ?, ?, ?)',
          ['login_failed', `No password set for user: ${username}`, stationId || 1, getBaghdadNow()] as BindParams
        );
        return { success: false, error: 'No password set for this account' };
      }

      const isValid = bcrypt.compareSync(password, passwordHash);
      if (!isValid) {
        runSql(
          'INSERT INTO system_events (event_type, details, station_id, timestamp) VALUES (?, ?, ?, ?)',
          ['login_failed', `Invalid password for user: ${username}`, stationId || 1, getBaghdadNow()] as BindParams
        );
        return { success: false, error: 'Invalid credentials' };
      }

      const userId = user[0] as number;
      const role = user[2] as 'owner' | 'manager' | 'barber';
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      database.run(
        'INSERT INTO user_sessions (session_id, user_id, station_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?)',
        [sessionId, userId, stationId || 1, getBaghdadNow(), new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()] as BindParams
      );

      runSql(
        'INSERT INTO system_events (event_type, details, station_id, timestamp) VALUES (?, ?, ?, ?)',
        ['login_success', `User ${username} logged in`, stationId || 1, getBaghdadNow()] as BindParams
      );

      return { success: true, user: { id: userId, username: user[1] as string, role }, sessionId };
    } catch (error) {
      return { success: false, error: 'Authentication failed' };
    }
  });

  ipcMain.handle('auth:loginPin', async (_event, pin: string, stationId: number) => {
    try {
      const users = runQuery('SELECT * FROM users WHERE role = ? AND is_active = 1', ['barber']);
      let matchedUser = null;
      
      for (const user of users) {
        const pinHash = user[4] as string | null;
        if (pinHash && bcrypt.compareSync(pin, pinHash)) {
          matchedUser = user;
          break;
        }
      }

      if (!matchedUser) {
        runSql(
          'INSERT INTO system_events (event_type, details, station_id, timestamp) VALUES (?, ?, ?, ?)',
          ['login_failed', `Invalid PIN attempt`, stationId || 1, getBaghdadNow()] as BindParams
        );
        return { success: false, error: 'Invalid PIN' };
      }

      const userId = matchedUser[0] as number;
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      database.run(
        'INSERT INTO user_sessions (session_id, user_id, station_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?)',
        [sessionId, userId, stationId || 1, getBaghdadNow(), new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()] as BindParams
      );

      runSql(
        'INSERT INTO system_events (event_type, details, station_id, timestamp) VALUES (?, ?, ?, ?)',
        ['login_success', `Barber ${matchedUser[1]} logged in via PIN`, stationId || 1, getBaghdadNow()] as BindParams
      );

      return { success: true, user: { id: userId, username: matchedUser[1] as string, role: 'barber' as const }, sessionId };
    } catch (error) {
      return { success: false, error: 'Authentication failed' };
    }
  });

  ipcMain.handle('auth:logout', async (_event, sessionId: string) => {
    try {
      if (sessionId) {
        database.run('DELETE FROM user_sessions WHERE session_id = ?', [sessionId] as BindParams);
        runSql(
          'INSERT INTO system_events (event_type, details, station_id, timestamp) VALUES (?, ?, ?, ?)',
          ['logout', `Session ${sessionId} logged out`, 1, getBaghdadNow()] as BindParams
        );
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Logout failed' };
    }
  });

  ipcMain.handle('auth:verifySession', async (_event, sessionId: string) => {
    try {
      if (!sessionId) return { valid: false };
      
      const session = runOne('SELECT * FROM user_sessions WHERE session_id = ? AND expires_at > ?', [sessionId, getBaghdadNow()]);
      if (!session) return { valid: false };
      
      const user = runOne('SELECT id, username, role FROM users WHERE id = ? AND is_active = 1', [session[1]]);
      if (!user) return { valid: false };
      
      return { valid: true, user: { id: user[0] as number, username: user[1] as string, role: user[2] as 'owner' | 'manager' | 'barber' } };
    } catch (error) {
      return { valid: false };
    }
  });

  ipcMain.handle('auth:getCurrentUser', async (_event, sessionId: string) => {
    try {
      if (!sessionId) return { user: null };
      
      const session = runOne('SELECT * FROM user_sessions WHERE session_id = ? AND expires_at > ?', [sessionId, getBaghdadNow()]);
      if (!session) return { user: null };
      
      const user = runOne('SELECT id, username, role FROM users WHERE id = ? AND is_active = 1', [session[1]]);
      if (!user) return { user: null };
      
      return { user: { id: user[0] as number, username: user[1] as string, role: user[2] as 'owner' | 'manager' | 'barber' } };
    } catch (error) {
      return { user: null };
    }
  });

  ipcMain.handle('auth:changePassword', async (_event, sessionId: string, oldPassword: string, newPassword: string) => {
    try {
      const session = runOne('SELECT * FROM user_sessions WHERE session_id = ? AND expires_at > ?', [sessionId, getBaghdadNow()]);
      if (!session) return { success: false, error: 'Invalid session' };
      
      const userId = session[1] as number;
      const user = runOne('SELECT * FROM users WHERE id = ?', [userId]);
      if (!user) return { success: false, error: 'User not found' };
      
      const passwordHash = user[3] as string | null;
      if (!passwordHash || !bcrypt.compareSync(oldPassword, passwordHash)) {
        return { success: false, error: 'Current password is incorrect' };
      }
      
      const newPasswordHash = bcrypt.hashSync(newPassword, 10);
      database.run('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', [newPasswordHash, getBaghdadNow(), userId] as BindParams);
      
      runSql(
        'INSERT INTO system_events (event_type, details, station_id, timestamp) VALUES (?, ?, ?, ?)',
        ['password_changed', `Password changed for user ${user[1]}`, 1, getBaghdadNow()] as BindParams
      );
      
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Failed to change password' };
    }
  });

ipcMain.handle('auth:setPin', async (_event, sessionId: string, pin: string) => {
    try {
      const session = runOne('SELECT * FROM user_sessions WHERE session_id = ? AND expires_at > ?', [sessionId, getBaghdadNow()]);
      if (!session) return { success: false, error: 'Invalid session' };
      
      const userId = session[1] as number;
      const pinHash = bcrypt.hashSync(pin, 10);
      // Check if PIN is already used by another active barber
      const existingPin = runOne('SELECT id FROM users WHERE role = ? AND pin_hash = ? AND is_active = 1 AND id != ?', ['barber', pinHash, userId]);
      if (existingPin) {
        return { success: false, error: 'PIN already in use by another active barber' };
      }
      database.run('UPDATE users SET pin_hash = ?, updated_at = ? WHERE id = ?', [pinHash, getBaghdadNow(), userId] as BindParams);
      
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Failed to set PIN' };
    }
  });

  ipcMain.handle('auth:createUser', async (_event, sessionId: string, username: string, role: 'owner' | 'manager' | 'barber', password?: string, pin?: string) => {
    try {
      const session = runOne('SELECT * FROM user_sessions WHERE session_id = ? AND expires_at > ?', [sessionId, getBaghdadNow()]);
      if (!session) return { success: false, error: 'Invalid session' };
      
      const requesterId = session[1] as number;
      const requester = runOne('SELECT role FROM users WHERE id = ?', [requesterId]);
      if (!requester || requester[0] !== 'owner') {
        return { success: false, error: 'Only owner can create users' };
      }
      
      if (role === 'owner') {
        return { success: false, error: 'Cannot create another owner' };
      }
      
      const now = getBaghdadNow();
      const passwordHash = password ? bcrypt.hashSync(password, 10) : null;
      const pinHash = pin ? bcrypt.hashSync(pin, 10) : null;
      // Check PIN uniqueness for barbers
      if (role === 'barber' && pinHash) {
        const existingPin = runOne('SELECT id FROM users WHERE role = ? AND pin_hash = ? AND is_active = 1', ['barber', pinHash]);
        if (existingPin) {
          return { success: false, error: 'PIN already in use by another active barber' };
        }
      }
      
      const result = database.run(
        'INSERT INTO users (username, role, password_hash, pin_hash, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [username, role, passwordHash, pinHash, 1, now, now] as BindParams
      );
      
      runSql(
        'INSERT INTO system_events (event_type, details, station_id, timestamp) VALUES (?, ?, ?, ?)',
        ['user_created', `User ${username} created with role ${role}`, 1, getBaghdadNow()] as BindParams
      );
      
      const lastIdResult = database.exec('SELECT last_insert_rowid()');
      const lastId = lastIdResult[0]?.values[0]?.[0] as number || 0;
      return { success: true, userId: lastId };
    } catch (error) {
      return { success: false, error: 'Failed to create user' };
    }
  });

  ipcMain.handle('auth:deactivateUser', async (_event, sessionId: string, userId: number) => {
    try {
      const session = runOne('SELECT * FROM user_sessions WHERE session_id = ? AND expires_at > ?', [sessionId, getBaghdadNow()]);
      if (!session) return { success: false, error: 'Invalid session' };
      
      const requesterId = session[1] as number;
      const requester = runOne('SELECT role FROM users WHERE id = ?', [requesterId]);
      if (!requester || requester[0] !== 'owner') {
        return { success: false, error: 'Only owner can deactivate users' };
      }
      
      if (userId === requesterId) {
        return { success: false, error: 'Cannot deactivate yourself' };
      }
      
      const targetUser = runOne('SELECT role FROM users WHERE id = ?', [userId]);
      if (!targetUser) return { success: false, error: 'User not found' };
      if (targetUser[0] === 'owner') return { success: false, error: 'Cannot deactivate owner' };
      
      database.run('UPDATE users SET is_active = 0, updated_at = ? WHERE id = ?', [getBaghdadNow(), userId] as BindParams);
      database.run('DELETE FROM user_sessions WHERE user_id = ?', [userId] as BindParams);
      
      runSql(
        'INSERT INTO system_events (event_type, details, station_id, timestamp) VALUES (?, ?, ?, ?)',
        ['user_deactivated', `User ${userId} deactivated`, 1, getBaghdadNow()] as BindParams
      );
      
return { success: true };
    } catch (error) {
      return { success: false, error: 'Failed to deactivate user' };
    }
  });

  ipcMain.handle('auth:listUsers', async (_event, sessionId: string) => {
    try {
      const session = runOne('SELECT * FROM user_sessions WHERE session_id = ? AND expires_at > ?', [sessionId, getBaghdadNow()]);
      if (!session) return { users: [] };
      
      const requesterId = session[1] as number;
      const requester = runOne('SELECT role FROM users WHERE id = ?', [requesterId]);
      if (!requester || requester[0] !== 'owner') {
        return { users: [] };
      }
      
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
      // Only allow if no Owner exists
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
      
      const now = getBaghdadNow();
      const passwordHash = bcrypt.hashSync(password, 10);
      
      const result = runSql(
        'INSERT INTO users (username, role, password_hash, pin_hash, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        ['owner', 'owner', passwordHash, null, 1, getBaghdadNow(), getBaghdadNow()] as BindParams
      );
      
      runSql(
        'INSERT INTO system_events (event_type, details, station_id, timestamp) VALUES (?, ?, ?, ?)',
        ['first_run_setup', `First Owner account created: ${username}`, 1, getBaghdadNow()] as BindParams
      );
      
      return { success: true, userId: result.lastInsertRowid };
    } catch (error) {
      return { success: false, error: 'Failed to create Owner account' };
    }
  });

  // Service IPC handlers
  ipcMain.handle('services:getAll', async (_event, limit = 100, offset = 0, includeDeleted = false) => {
    try {
      const whereClause = includeDeleted ? "" : "WHERE is_deleted = 0";
      return runQuery(
        `SELECT * FROM services ${whereClause} ORDER BY name LIMIT ? OFFSET ?`,
        [limit, offset] as BindParams
      );
    } catch (error) {
      return [];
    }
  });

  ipcMain.handle('services:getById', async (_event, id: number) => {
    try {
      return runOne("SELECT * FROM services WHERE id = ?", [id]);
    } catch (error) {
      return undefined;
    }
  });

  ipcMain.handle('services:create', async (_event, name: string, description: string, price: number) => {
    try {
      if (!name || !name.trim()) {
        return { success: false, error: 'Service name is required' };
      }
      if (price < 0) {
        return { success: false, error: 'Price cannot be negative' };
      }

      const result = runSql(
        'INSERT INTO services (name, description, price, is_deleted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        [name.trim(), description?.trim() || "", price, 0, getBaghdadNow(), getBaghdadNow()] as BindParams
      );

      runSql(
        'INSERT INTO system_events (event_type, details, station_id, timestamp) VALUES (?, ?, ?, ?)',
        ['service_created', `Service created: ${name.trim()} (${price} IQD)`, 1, getBaghdadNow()] as BindParams
      );

      return { success: true, id: result.lastInsertRowid };
    } catch (error) {
      return { success: false, error: 'Failed to create service' };
    }
  });

  ipcMain.handle('services:update', async (_event, id: number, name: string, description: string, price: number) => {
    try {
      if (!name || !name.trim()) {
        return { success: false, error: 'Service name is required' };
      }
      if (price < 0) {
        return { success: false, error: 'Price cannot be negative' };
      }

      const result = runSql(
        'UPDATE services SET name = ?, description = ?, price = ?, updated_at = ? WHERE id = ?',
        [name.trim(), description?.trim() || "", price, getBaghdadNow(), id] as BindParams
      );

      return { success: true, changes: result.changes };
    } catch (error) {
      return { success: false, error: 'Failed to update service' };
    }
  });

  ipcMain.handle('services:delete', async (_event, id: number) => {
    try {
      const result = runSql('UPDATE services SET is_deleted = 1 WHERE id = ?', [id] as BindParams);
      return { success: true, changes: result.changes };
    } catch (error) {
      return { success: false, error: 'Failed to delete service' };
    }
  });

  ipcMain.handle('services:getActive', async () => {
    try {
      return runQuery('SELECT * FROM services WHERE is_deleted = 0 ORDER BY name');
    } catch (error) {
      return [];
    }
  });

  // Product IPC handlers
  ipcMain.handle('products:getAll', async (_event, limit = 100, offset = 0, includeDeleted = false) => {
    try {
      const whereClause = includeDeleted ? "" : "WHERE is_deleted = 0";
      return runQuery(
        `SELECT * FROM products ${whereClause} ORDER BY name LIMIT ? OFFSET ?`,
        [limit, offset] as BindParams
      );
    } catch (error) {
      return [];
    }
  });

  ipcMain.handle('products:getLowStock', async (_event, threshold = 5) => {
    try {
      return runQuery(
        "SELECT * FROM products WHERE quantity < ? AND is_deleted = 0",
        [threshold] as BindParams
      );
    } catch (error) {
      return [];
    }
  });

  ipcMain.handle('products:getById', async (_event, id: number) => {
    try {
      return runOne("SELECT * FROM products WHERE id = ?", [id]);
    } catch (error) {
      return undefined;
    }
  });

  ipcMain.handle('products:create', async (_event, name: string, price: number, costPrice: number, quantity: number, lowStockThreshold: number) => {
    try {
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

      const result = runSql(
        'INSERT INTO products (name, price, cost_price, quantity, low_stock_threshold, is_deleted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [name.trim(), price, costPrice, quantity, lowStockThreshold, 0, getBaghdadNow(), getBaghdadNow()] as BindParams
      );

      return { success: true, id: result.lastInsertRowid };
    } catch (error) {
      return { success: false, error: 'Failed to create product' };
    }
  });

  ipcMain.handle('products:update', async (_event, id: number, name: string, price: number, costPrice: number, quantity: number, lowStockThreshold: number) => {
    try {
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

      const result = runSql(
        'UPDATE products SET name = ?, price = ?, cost_price = ?, quantity = ?, low_stock_threshold = ?, updated_at = ? WHERE id = ?',
        [name.trim(), price, costPrice, quantity, lowStockThreshold, getBaghdadNow(), id] as BindParams
      );

      return { success: true, changes: result.changes };
    } catch (error) {
      return { success: false, error: 'Failed to update product' };
    }
  });

  ipcMain.handle('products:delete', async (_event, id: number) => {
    try {
      const result = runSql('UPDATE products SET is_deleted = 1 WHERE id = ?', [id] as BindParams);
      return { success: true, changes: result.changes };
    } catch (error) {
      return { success: false, error: 'Failed to delete product' };
    }
  });

  ipcMain.handle('products:updateStock', async (_event, productId: number, newQuantity: number) => {
    try {
      if (newQuantity < 0) {
        return { success: false, error: 'Quantity cannot be negative' };
      }
      const result = runSql('UPDATE products SET quantity = ?, updated_at = ? WHERE id = ?', [newQuantity, getBaghdadNow(), productId] as BindParams);
      return { success: true, changes: result.changes };
    } catch (error) {
      return { success: false, error: 'Failed to update stock' };
    }
  });

  ipcMain.handle('products:getLowStockCount', async () => {
    try {
      const result = runQuery("SELECT COUNT(*) as count FROM products WHERE quantity <= low_stock_threshold AND is_deleted = 0");
      return (result[0]?.[0] as number) || 0;
    } catch (error) {
      return 0;
    }
  });

  ipcMain.handle('products:getActive', async () => {
    try {
      return runQuery('SELECT * FROM products WHERE is_deleted = 0 ORDER BY name');
    } catch (error) {
      return [];
    }
  });

  // Expense Category IPC handlers
  ipcMain.handle('expenseCategories:getAll', async (_event, limit = 100, offset = 0, includeDeleted = false) => {
    try {
      const whereClause = includeDeleted ? "" : "WHERE is_deleted = 0";
      return runQuery(
        `SELECT * FROM expense_categories ${whereClause} ORDER BY name LIMIT ? OFFSET ?`,
        [limit, offset] as BindParams
      );
    } catch (error) {
      return [];
    }
  });

  ipcMain.handle('expenseCategories:getById', async (_event, id: number) => {
    try {
      return runOne('SELECT * FROM expense_categories WHERE id = ?', [id]);
    } catch (error) {
      return undefined;
    }
  });

  ipcMain.handle('expenseCategories:create', async (_event, name: string) => {
    try {
      if (!name || !name.trim()) {
        return { success: false, error: 'Category name is required' };
      }
      const result = runSql(
        'INSERT INTO expense_categories (name, is_deleted, created_at) VALUES (?, ?, ?)',
        [name.trim(), 0, getBaghdadNow()] as BindParams
      );
      return { success: true, id: result.lastInsertRowid };
    } catch (error) {
      return { success: false, error: 'Failed to create category' };
    }
  });

  ipcMain.handle('expenseCategories:update', async (_event, id: number, name: string) => {
    try {
      if (!name || !name.trim()) {
        return { success: false, error: 'Category name is required' };
      }
      const result = runSql('UPDATE expense_categories SET name = ? WHERE id = ?', [name.trim(), id] as BindParams);
      return { success: true, changes: result.changes };
    } catch (error) {
      return { success: false, error: 'Failed to update category' };
    }
  });

  ipcMain.handle('expenseCategories:delete', async (_event, id: number) => {
    try {
      const result = runSql('UPDATE expense_categories SET is_deleted = 1 WHERE id = ?', [id] as BindParams);
      return { success: true, changes: result.changes };
    } catch (error) {
      return { success: false, error: 'Failed to delete category' };
    }
  });

  ipcMain.handle('expenseCategories:getActive', async () => {
    try {
      return runQuery('SELECT * FROM expense_categories WHERE is_deleted = 0 ORDER BY name');
    } catch (error) {
      return [];
    }
  });

  // Expense IPC handlers
  ipcMain.handle('expenses:getAll', async (_event, limit = 100, offset = 0, includeDeleted = false) => {
    try {
      const whereClause = includeDeleted ? "" : "WHERE is_deleted = 0";
      return runQuery(
        `SELECT * FROM expenses ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [limit, offset] as BindParams
      );
    } catch (error) {
      return [];
    }
  });

  ipcMain.handle('expenses:getById', async (_event, id: number) => {
    try {
      return runOne('SELECT * FROM expenses WHERE id = ?', [id]);
    } catch (error) {
      return undefined;
    }
  });

  ipcMain.handle('expenses:create', async (_event, category: string, amount: number, description: string) => {
    try {
      if (!category || !category.trim()) {
        return { success: false, error: 'Category is required' };
      }
      if (amount <= 0) {
        return { success: false, error: 'Amount must be greater than zero' };
      }

      const result = runSql(
        'INSERT INTO expenses (category, amount, description, is_deleted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        [category.trim(), amount, description?.trim() || "", 0, getBaghdadNow(), getBaghdadNow()] as BindParams
      );

      return { success: true, id: result.lastInsertRowid };
    } catch (error) {
      return { success: false, error: 'Failed to create expense' };
    }
  });

  ipcMain.handle('expenses:update', async (_event, id: number, category: string, amount: number, description: string) => {
    try {
      if (!category || !category.trim()) {
        return { success: false, error: 'Category is required' };
      }
      if (amount <= 0) {
        return { success: false, error: 'Amount must be greater than zero' };
      }

      const result = runSql(
        'UPDATE expenses SET category = ?, amount = ?, description = ?, updated_at = ? WHERE id = ?',
        [category.trim(), amount, description?.trim() || "", getBaghdadNow(), id] as BindParams
      );

      return { success: true, changes: result.changes };
    } catch (error) {
      return { success: false, error: 'Failed to update expense' };
    }
  });

  ipcMain.handle('expenses:delete', async (_event, id: number) => {
    try {
      const result = runSql('UPDATE expenses SET is_deleted = 1 WHERE id = ?', [id] as BindParams);
      return { success: true, changes: result.changes };
    } catch (error) {
      return { success: false, error: 'Failed to delete expense' };
    }
  });

  ipcMain.handle('expenses:getCategories', async () => {
    try {
      return runQuery('SELECT * FROM expense_categories WHERE is_deleted = 0 ORDER BY name');
    } catch (error) {
      return [];
    }
  });

  // Expense Category IPC handlers
  ipcMain.handle('expenseCategories:getAll', async (_event, limit = 100, offset = 0, includeDeleted = false) => {
    try {
      const whereClause = includeDeleted ? "" : "WHERE is_deleted = 0";
      return runQuery(
        `SELECT * FROM expense_categories ${whereClause} ORDER BY name LIMIT ? OFFSET ?`,
        [limit, offset] as BindParams
      );
    } catch (error) {
      return [];
    }
  });

  ipcMain.handle('expenseCategories:getById', async (_event, id: number) => {
    try {
      return runOne('SELECT * FROM expense_categories WHERE id = ?', [id]);
    } catch (error) {
      return undefined;
    }
  });

  ipcMain.handle('expenseCategories:create', async (_event, name: string) => {
    try {
      if (!name || !name.trim()) {
        return { success: false, error: 'Category name is required' };
      }
      const result = runSql(
        'INSERT INTO expense_categories (name, is_deleted, created_at) VALUES (?, ?, ?)',
        [name.trim(), 0, getBaghdadNow()] as BindParams
      );
      return { success: true, id: result.lastInsertRowid };
    } catch (error) {
      return { success: false, error: 'Failed to create category' };
    }
  });

  ipcMain.handle('expenseCategories:update', async (_event, id: number, name: string) => {
    try {
      if (!name || !name.trim()) {
        return { success: false, error: 'Category name is required' };
      }
      const result = runSql('UPDATE expense_categories SET name = ? WHERE id = ?', [name.trim(), id] as BindParams);
      return { success: true, changes: result.changes };
    } catch (error) {
      return { success: false, error: 'Failed to update category' };
    }
  });

  ipcMain.handle('expenseCategories:delete', async (_event, id: number) => {
    try {
      const result = runSql('UPDATE expense_categories SET is_deleted = 1 WHERE id = ?', [id] as BindParams);
      return { success: true, changes: result.changes };
    } catch (error) {
      return { success: false, error: 'Failed to delete category' };
    }
  });

  ipcMain.handle('expenseCategories:getActive', async () => {
    try {
      return runQuery('SELECT * FROM expense_categories WHERE is_deleted = 0 ORDER BY name');
    } catch (error) {
      return [];
    }
  });

  // Audit Log IPC handlers
  ipcMain.handle('auditLog:getAll', async (_event, limit = 100, offset = 0, entityType?: string, entityId?: number) => {
    try {
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
      return runQuery(
        `SELECT * FROM audit_log ${whereClause} ORDER BY changed_at DESC LIMIT ? OFFSET ?`,
        params
      );
    } catch (error) {
      return [];
    }
  });

  ipcMain.handle('auditLog:getByEntity', async (_event, entityType: string, entityId: number) => {
    try {
      return runQuery(
        'SELECT * FROM audit_log WHERE entity_type = ? AND entity_id = ? ORDER BY changed_at DESC',
        [entityType, entityId] as BindParams
      );
    } catch (error) {
      return [];
    }
  });

  ipcMain.handle('auditLog:getCount', async (_event, entityType?: string, entityId?: number) => {
    try {
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

      const result = runQuery(
        `SELECT COUNT(*) as count FROM audit_log ${whereClause}`,
        params
      );
      return (result[0]?.[0] as number) || 0;
    } catch (error) {
      return 0;
    }
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
