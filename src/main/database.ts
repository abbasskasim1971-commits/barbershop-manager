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
  saleUuid: string;
  barberId: number;
  stationId: number;
  totalAmount: number;
  cashAmount: number;
  isDeleted: boolean;
  createdAt: string;
  createdBy: number;
}

export interface StationRecord {
  id: number;
  stationUuid: string;
  role: "owner" | "barber";
  label: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
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

const STATION_DEVICE_KEY = "station.device_id";

// Returns the UUID of the station this device is bound to, looked up via the
// persisted app_settings value. Never read from the renderer.
export function getDeviceStationUuid(): string {
  if (!db) return "";
  const row = runOne("SELECT value FROM app_settings WHERE key = ?", [
    STATION_DEVICE_KEY,
  ] as BindParams);
  return (row?.[0] as string) || "";
}

// The local session/legacy station integer (defaults to 1) for this device's
// bound station. Resolves the persisted device UUID to its integer station id.
export function getDeviceStationId(): number {
  const uuid = getDeviceStationUuid();
  if (!uuid) return 1;
  const row = runOne("SELECT id FROM stations WHERE station_uuid = ? AND is_active = 1", [
    uuid,
  ] as BindParams);
  return (row?.[0] as number) || 1;
}

// Ensures this device always has a persisted station identity. Used at startup
// as well as during migration for robustness if the row is ever cleared.
export function ensureDeviceIdentity(): void {
  if (!db) return;
  const existing = getDeviceStationUuid();
  if (existing) return;
  const owner = runOne(
    "SELECT station_uuid FROM stations WHERE role = 'owner' AND is_active = 1 ORDER BY id LIMIT 1",
  );
  const uuid = (owner?.[0] as string) || `station_${crypto.randomUUID()}`;
  db.run("INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)", [
    STATION_DEVICE_KEY,
    uuid,
  ] as BindParams);
  if (!inTransaction) saveDatabase();
}

// The single owner/master station id in this shop. Barbers are expected to
// resolve their own station (potentially a different role='barber' station)
// via the device identity.
export function getOwnerStationId(): number {
  const row = runOne(
    "SELECT id FROM stations WHERE role = 'owner' AND is_active = 1 ORDER BY id LIMIT 1",
  );
  return (row?.[0] as number) || 1;
}

export function isOwnerStation(stationId: number): boolean {
  return stationId === getOwnerStationId();
}

export interface TokenStation {
  id: number;
  role: "owner" | "barber";
  isActive: boolean;
  tokenHash: string;
}

// All stations that have a provisioned outbound API token. The caller compares
// a candidate token hash constant-time (timingSafeEqual) rather than letting
// SQL do an early-exit string comparison.
export function listTokenStations(): TokenStation[] {
  const rows = runQuery(
    "SELECT id, role, is_active, api_token_hash FROM stations WHERE api_token_hash IS NOT NULL AND api_token_hash != ''",
  );
  return rows.map((r) => ({
    id: r[0] as number,
    role: r[1] as "owner" | "barber",
    isActive: r[2] === 1,
    tokenHash: r[3] as string,
  }));
}

const OUTBOX_STATUS_PENDING = "pending";

// ── Sync client configuration & status ───────────────────────────────────
// Represents whether THIS device has been provisioned as a barber touch
// station (owner + port + token configured, device identity is a barber
// station). Owner devices are never "provisioned" in this sense.
export function getAppSetting(key: string): string | null {
  const row = runOne("SELECT value FROM app_settings WHERE key = ?", [key] as BindParams);
  return (row?.[0] as string) ?? null;
}

export function setAppSetting(key: string, value: string): void {
  runSql(
    "INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [key, value] as BindParams,
  );
}

const PROVISIONED_KEY = "sync.provisioned";

export function isBarberProvisioned(): boolean {
  if (getAppSetting(PROVISIONED_KEY) !== "1") return false;
  const uuid = getDeviceStationUuid();
  if (!uuid) return false;
  const station = runOne("SELECT role FROM stations WHERE station_uuid = ? AND is_active = 1", [
    uuid,
  ] as BindParams);
  return !!station && station[0] === "barber";
}

export interface SyncClientConfig {
  ownerHost: string;
  ownerPort: number;
  token: string;
}

export function getSyncClientConfig(): SyncClientConfig | null {
  const host = getAppSetting("sync.owner_host");
  const portRaw = getAppSetting("sync.owner_port");
  const token = getAppSetting("sync.station_token");
  if (!host || !portRaw || !token) return null;
  const port = Number.parseInt(portRaw, 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
  return { ownerHost: host, ownerPort: port, token };
}

export function setSyncClientConfig(
  config: SyncClientConfig,
  stationUuid: string,
  stationId: number,
  label: string | null,
): void {
  const now = getUtcNow();
  beginTransaction();
  try {
    setAppSetting("sync.owner_host", config.ownerHost);
    setAppSetting("sync.owner_port", String(config.ownerPort));
    setAppSetting("sync.station_token", config.token);
    // Materialize this device's barber station locally with the AUTHORITATIVE
    // integer id from the owner, so local sales always resolve to the owner's
    // station id (source_station_id) and the device identity resolves to a real
    // row on this device.
    runSql(
      `INSERT INTO stations (id, station_uuid, role, label, is_active, created_at, updated_at)
       VALUES (?, ?, 'barber', ?, 1, ?, ?)
       ON CONFLICT(station_uuid) DO UPDATE SET is_active = 1, label = excluded.label, updated_at = excluded.updated_at`,
      [stationId, stationUuid, label, now, now] as BindParams,
    );
    setAppSetting("station.device_id", stationUuid);
    setAppSetting(PROVISIONED_KEY, "1");
    commitTransaction();
  } catch (error) {
    rollbackTransaction();
    throw error;
  }
}

export function setSyncStatusField(
  key: "state" | "syncing" | "last_success_at" | "last_error_at" | "last_error",
  value: string | null,
): void {
  if (value === null) {
    runSql("DELETE FROM app_settings WHERE key = ?", [`sync.${key}`] as BindParams);
  } else {
    setAppSetting(`sync.${key}`, value);
  }
}

export interface SyncStatus {
  role: "owner" | "barber";
  provisioned: boolean;
  pending: number;
  sending: number;
  failed: number;
  sent: number;
  state: "online" | "offline" | "idle" | "syncing";
  syncing: boolean;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastError: string | null;
}

export function getSyncStatus(): SyncStatus {
  const provisioned = isBarberProvisioned();
  const counts: Record<string, number> = { pending: 0, sending: 0, failed: 0, sent: 0 };
  const rows = runQuery("SELECT status, COUNT(*) FROM sync_outbox GROUP BY status");
  for (const row of rows) {
    const status = row[0] as string;
    if (status in counts) counts[status] = row[1] as number;
  }
  const stateRaw = getAppSetting("sync.state");
  const syncing = getAppSetting("sync.syncing") === "1";
  const state = syncing
    ? "syncing"
    : stateRaw === "online" || stateRaw === "offline"
      ? stateRaw
      : "idle";
  return {
    role: provisioned ? "barber" : "owner",
    provisioned,
    pending: counts.pending,
    sending: counts.sending,
    failed: counts.failed,
    sent: counts.sent,
    state,
    syncing,
    lastSuccessAt: getAppSetting("sync.last_success_at"),
    lastErrorAt: getAppSetting("sync.last_error_at"),
    lastError: getAppSetting("sync.last_error"),
  };
}

// ── Outbox delivery state machine ────────────────────────────────────────
// pending   = queued, eligible for (auto or manual) delivery
// sending   = claimed by an in-flight worker run (restart-safe: stale rows are
//             re-claimed on the next run)
// sent      = owner acknowledged (accepted or duplicate) — terminal
// failed    = a delivery attempt failed; retry scheduled via next_retry_at, or
//             next_retry_at NULL for permanent failures (manual retry only)
//
// A row is never marked 'sent' except after an explicit owner acknowledgement.

export interface OutboxEntry {
  id: number;
  saleUuid: string;
  sourceStationId: number;
  payload: Record<string, unknown>;
  attempts: number;
}

function rowToOutboxEntry(row: SqlValue[]): OutboxEntry {
  return {
    id: row[0] as number,
    saleUuid: row[1] as string,
    sourceStationId: row[2] as number,
    payload: JSON.parse(row[3] as string) as Record<string, unknown>,
    attempts: row[4] as number,
  };
}

// Claims eligible entries for delivery. Auto mode targets pending (or stale
// 'sending' rows left by a previously interrupted run) plus failed rows whose
// backoff window has elapsed. Manual mode retries every pending/failed row.
export function claimDueOutboxEntries(now: string, manual: boolean): OutboxEntry[] {
  const where = manual
    ? "status IN ('pending', 'failed', 'sending')"
    : "(status = 'pending' OR status = 'sending') OR (status = 'failed' AND next_retry_at IS NOT NULL AND next_retry_at <= ?)";
  const rows = runQuery(
    `SELECT id, sale_uuid, source_station_id, payload_json, attempts FROM sync_outbox WHERE ${where} ORDER BY id ASC`,
    manual ? [] : ([now] as BindParams),
  );
  const entries = rows.map(rowToOutboxEntry);
  if (entries.length > 0) {
    for (const entry of entries) {
      runSql("UPDATE sync_outbox SET status = ?, updated_at = ? WHERE id = ?", [
        "sending",
        now,
        entry.id,
      ] as BindParams);
    }
  }
  return entries;
}

export function markOutboxSent(id: number, sentAt: string): void {
  runSql(
    "UPDATE sync_outbox SET status = ?, sent_at = ?, error = NULL, next_retry_at = NULL, updated_at = ? WHERE id = ?",
    ["sent", sentAt, sentAt, id] as BindParams,
  );
}

export function markOutboxFailed(
  id: number,
  attempts: number,
  error: string,
  nextRetryAt: string | null,
): void {
  runSql(
    "UPDATE sync_outbox SET status = ?, attempts = ?, error = ?, next_retry_at = ?, updated_at = ? WHERE id = ?",
    ["failed", attempts, error === "" ? null : error, nextRetryAt, getUtcNow(), id] as BindParams,
  );
}

// ── Owner -> barber catalog application ───────────────────────────────────
// The owner is authoritative: rows are upserted by owner id, so authoritative
// ids and effective data are preserved, and owner-deleted services are marked
// locally. Barbers (only) are synced with their bcrypt PIN hash to keep the
// touch station usable offline.

export interface SyncedService {
  id: number;
  name: string;
  description: string | null;
  price: number;
  isDeleted: boolean;
  updatedAt: string;
}

export interface SyncedBarber {
  id: number;
  username: string;
  pinHash: string | null;
  isActive: boolean;
  updatedAt: string;
}

export function applySyncedCatalog(services: SyncedService[], barbers: SyncedBarber[]): void {
  beginTransaction();
  try {
    for (const svc of services) {
      runSql(
        "INSERT INTO services (id, name, description, price, is_deleted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, description = excluded.description, price = excluded.price, is_deleted = excluded.is_deleted, updated_at = excluded.updated_at",
        [
          svc.id,
          svc.name,
          svc.description,
          svc.price,
          svc.isDeleted ? 1 : 0,
          svc.updatedAt,
          svc.updatedAt,
        ] as BindParams,
      );
    }
    for (const barber of barbers) {
      runSql(
        "INSERT INTO users (id, username, role, password_hash, pin_hash, is_active, created_at, updated_at) VALUES (?, ?, 'barber', NULL, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET username = excluded.username, role = 'barber', pin_hash = excluded.pin_hash, is_active = excluded.is_active, updated_at = excluded.updated_at",
        [
          barber.id,
          barber.username,
          barber.pinHash,
          barber.isActive ? 1 : 0,
          barber.updatedAt,
          barber.updatedAt,
        ] as BindParams,
      );
    }
    commitTransaction();
  } catch (error) {
    rollbackTransaction();
    throw error;
  }
  logSystemEvent(
    "sync_catalog_applied",
    `Applied catalog: ${services.length} services, ${barbers.length} barbers`,
    getDeviceStationId(),
  );
}

// Inserts a barber-station sale into the durable local outbox for later sync.
// Runs inside the caller's active transaction so sale + outbox commit/rollback
// together. INSERT OR IGNORE combined with UNIQUE (sale_uuid, source_station_id)
// makes duplicate enqueue attempts idempotent: at most one row per outbound sale.
export function enqueueSaleOutbox(
  saleUuid: string,
  sourceStationId: number,
  payload: Record<string, unknown>,
): void {
  const now = getUtcNow();
  runSql(
    "INSERT OR IGNORE INTO sync_outbox (sale_uuid, source_station_id, payload_json, status, attempts, next_retry_at, sent_at, error, created_at, updated_at) VALUES (?, ?, ?, ?, 0, NULL, NULL, NULL, ?, ?)",
    [
      saleUuid,
      sourceStationId,
      JSON.stringify(payload),
      OUTBOX_STATUS_PENDING,
      now,
      now,
    ] as BindParams,
  );
}

// Main-process only: read-only queue inspection for diagnostics/tests. Never
// exposed to the renderer.
export function getPendingOutboxEntries(): Array<{
  id: number;
  saleUuid: string;
  sourceStationId: number;
  payload: Record<string, unknown>;
  status: string;
  attempts: number;
  createdAt: string;
}> {
  return runQuery(
    "SELECT id, sale_uuid, source_station_id, payload_json, status, attempts, created_at FROM sync_outbox ORDER BY id ASC",
  ).map((r) => ({
    id: r[0] as number,
    saleUuid: r[1] as string,
    sourceStationId: r[2] as number,
    payload: JSON.parse(r[3] as string) as Record<string, unknown>,
    status: r[4] as string,
    attempts: r[5] as number,
    createdAt: r[6] as string,
  }));
}

export function rowToStation(row: SqlValue[]): StationRecord {
  return {
    id: row[0] as number,
    stationUuid: row[1] as string,
    role: row[2] as "owner" | "barber",
    label: row[3] as string | null,
    isActive: row[4] === 1,
    createdAt: row[5] as string,
    updatedAt: row[6] as string,
  };
}

export function mapStations(rows: SqlValue[][]): StationRecord[] {
  return rows.map(rowToStation);
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

export function verifySession(
  sessionId: string,
): { userId: number; role: UserRole; stationId: number } | null {
  if (!sessionId) return null;
  const session = runOne(
    "SELECT user_id, station_id FROM user_sessions WHERE session_id = ? AND expires_at > ?",
    [sessionId, getUtcNow()] as BindParams,
  );
  if (!session) return null;
  const userId = session[0] as number;
  const stationId = (session[1] as number) || 1;
  const user = runOne("SELECT id, role FROM users WHERE id = ? AND is_active = 1", [
    userId,
  ] as BindParams);
  if (!user) return null;
  return { userId, role: user[1] as UserRole, stationId };
}

export function requireAuth(
  sessionId: string,
  allowedRoles: UserRole[],
): { userId: number; role: UserRole; stationId: number } | null {
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
    saleUuid: (row[8] as string) || "",
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
    saveDatabase();
  }

  runMigrations();
  seedDefaultUser();
  ensureDeviceIdentity();
  saveDatabase();
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

  if (!applied.has("004_phase10a_station_identity")) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS stations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        station_uuid TEXT NOT NULL UNIQUE,
        role TEXT NOT NULL DEFAULT 'barber' CHECK (role IN ('owner', 'barber')),
        label TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    const now = getUtcNow();
    // The genuine pre-10A database is a single owner/manager shop where all
    // rows carry station_id = 1. Seed that identical logical station (id=1,
    // role=owner) so legacy station_id references remain valid and the integer
    // id stays the local identity while station_uuid becomes the global one.
    const ownerStationUuid = `station_${crypto.randomUUID()}`;
    db.run(
      "INSERT OR IGNORE INTO stations (id, station_uuid, role, label, is_active, created_at, updated_at) VALUES (1, ?, 'owner', 'Main Station', 1, ?, ?)",
      [ownerStationUuid, now, now] as BindParams,
    );

    try {
      db.run("ALTER TABLE sales ADD COLUMN sale_uuid TEXT");
    } catch {
      // Column may already exist; ignore
    }

    db.exec(`
      UPDATE sales SET sale_uuid = lower(hex(randomblob(16)))
        WHERE sale_uuid IS NULL OR sale_uuid = '';
      CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_sale_uuid ON sales(sale_uuid);
    `);

    // This device's persisted station identity = the owner/master station on
    // this single-shop device. EnsureDeviceIdentity() reads this at runtime.
    db.run("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('station.device_id', ?)", [
      ownerStationUuid,
    ] as BindParams);

    db.run("INSERT INTO _migrations (name, applied_at) VALUES (?, ?)", [
      "004_phase10a_station_identity",
      getUtcNow(),
    ] as BindParams);
  }

  if (!applied.has("005_phase10b_outbox")) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS sync_outbox (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_uuid TEXT NOT NULL,
        source_station_id INTEGER NOT NULL,
        payload_json TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
        attempts INTEGER NOT NULL DEFAULT 0,
        next_retry_at TEXT,
        sent_at TEXT,
        error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (sale_uuid, source_station_id)
      );

      CREATE INDEX IF NOT EXISTS idx_sync_outbox_status_retry
        ON sync_outbox(status, next_retry_at);
    `);

    db.run("INSERT INTO _migrations (name, applied_at) VALUES (?, ?)", [
      "005_phase10b_outbox",
      getUtcNow(),
    ] as BindParams);
  }

  if (!applied.has("006_phase10c_owner_ingest")) {
    // Stations authenticate outbound sync pushes with a provisioned token; only
    // the sha256 hash is stored. Column is nullable: owner station and stations
    // without a provisioned token remain untouched.
    try {
      db.run("ALTER TABLE stations ADD COLUMN api_token_hash TEXT");
    } catch {
      // Column may already exist; ignore
    }

    db.run("INSERT INTO _migrations (name, applied_at) VALUES (?, ?)", [
      "006_phase10c_owner_ingest",
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
