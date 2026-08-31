import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { getDatabasePath } from './paths';
import * as fs from 'fs';
import initSqlJs, { Database, SqlValue, BindParams, SqlJsStatic } from 'sql.js';

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
  const sqlModule = await initSqlJs({ locateFile: () => 'sql-wasm.wasm' });
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
        pin TEXT,
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
}

function seedDefaultUser(): void {
  if (!db) return;
  const existing = db.exec("SELECT id FROM users WHERE role = 'owner'")[0]?.values[0];
  if (!existing) {
    const now = getBaghdadNow();
    db.run(
      "INSERT INTO users (username, role, pin, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      ['owner', 'owner', null, 1, now, now] as BindParams
    );
    saveDatabase();
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