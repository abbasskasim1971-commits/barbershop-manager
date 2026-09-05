import {
  getAppSetting,
  getUtcNow,
  isBarberProvisioned,
  runOne,
  runSql,
  setAppSetting,
} from "../database";
import type { DailyClosingRecord } from "../database";
import { buildClosingMessage } from "./message";
import { maskWhatsAppNumber } from "./number";

export type WhatsAppSessionState =
  "unlinked" | "linking" | "ready" | "disconnected" | "relink-required";

export interface WhatsAppSessionStatus {
  available: boolean;
  configured: boolean;
  numberMasked: string | null;
  state: WhatsAppSessionState;
  lastError: string | null;
  lastAttemptAt: string | null;
}

export interface SendResult {
  success: boolean;
  error?: string;
}

const SESSION_STATE_KEY = "whatsapp.session_state";
const OWNER_NUMBER_KEY = "whatsapp.owner_number";
const LAST_ERROR_KEY = "whatsapp.last_error";
const LAST_ATTEMPT_KEY = "whatsapp.last_attempt_at";

const STATES: WhatsAppSessionState[] = [
  "unlinked",
  "linking",
  "ready",
  "disconnected",
  "relink-required",
];

function isSessionState(value: string | null): value is WhatsAppSessionState {
  return (STATES as string[]).includes(value ?? "");
}

export function readSessionState(): WhatsAppSessionState {
  const raw = getAppSetting(SESSION_STATE_KEY);
  return isSessionState(raw) ? raw : "unlinked";
}

export function writeSessionState(state: WhatsAppSessionState): void {
  setAppSetting(SESSION_STATE_KEY, state);
}

export function getStoredOwnerNumber(): string | null {
  const value = getAppSetting(OWNER_NUMBER_KEY);
  return value && value !== "" ? value : null;
}

export function storeOwnerNumber(digits: string): void {
  setAppSetting(OWNER_NUMBER_KEY, digits);
  writeSessionState("unlinked");
  clearAttemptFields();
}

function clearAttemptFields(): void {
  runSql("DELETE FROM app_settings WHERE key = ?", [LAST_ERROR_KEY]);
  runSql("DELETE FROM app_settings WHERE key = ?", [LAST_ATTEMPT_KEY]);
}

export function getWhatsAppStatus(): WhatsAppSessionStatus {
  const available = !isBarberProvisioned();
  const number = getStoredOwnerNumber();
  return {
    available,
    configured: number !== null,
    numberMasked: number ? maskWhatsAppNumber(number) : null,
    state: readSessionState(),
    lastError: getAppSetting(LAST_ERROR_KEY),
    lastAttemptAt: getAppSetting(LAST_ATTEMPT_KEY),
  };
}

// Typed main-process driver abstraction. The real whatsapp-web.js driver
// (linked via QR) will implement this contract in a later phase; for now the
// NoopDriver keeps every path safe and gracefully failing without a dependency.
export interface WhatsAppDriver {
  readonly name: string;
  startLink(onQr: (qr: string) => void): Promise<void>;
  sendText(toNumber: string, text: string): Promise<void>;
  disconnect(): Promise<void>;
}

export class NoopDriver implements WhatsAppDriver {
  readonly name = "noop";
  async startLink(): Promise<void> {
    throw new Error("whatsapp driver not installed");
  }
  async sendText(): Promise<void> {
    throw new Error("whatsapp driver not installed");
  }
  async disconnect(): Promise<void> {
    return undefined;
  }
}

let activeDriver: WhatsAppDriver = new NoopDriver();

export function setDriver(driver: WhatsAppDriver): void {
  activeDriver = driver;
}

export function getActiveDriverName(): string {
  return activeDriver.name;
}

function recordAttempt(ok: boolean, error: string | null): void {
  setAppSetting(LAST_ATTEMPT_KEY, getUtcNow());
  if (error === null) {
    runSql("DELETE FROM app_settings WHERE key = ?", [LAST_ERROR_KEY]);
  } else {
    setAppSetting(LAST_ERROR_KEY, error);
  }
}

// Owner-only. Starts the QR pairing flow on the owner station. Without the
// real driver (Phase 11B) this returns a clear, structured error.
export async function beginWhatsAppLink(): Promise<SendResult> {
  if (isBarberProvisioned()) {
    return { success: false, error: "whatsapp unavailable on this station" };
  }
  if (!getStoredOwnerNumber()) {
    return { success: false, error: "owner whatsapp number not configured" };
  }
  writeSessionState("linking");
  try {
    await activeDriver.startLink(() => {
      // QR payload stays in main process; rendered by the owner screen.
    });
    writeSessionState("ready");
    return { success: true };
  } catch (error) {
    writeSessionState("unlinked");
    const message = error instanceof Error ? error.message : "linking failed";
    const result: SendResult = { success: false, error: message };
    recordAttempt(false, message);
    return result;
  }
}

// Owner-only. Clears the session back to unlinked (session re-linking).
export async function stopWhatsAppLink(): Promise<SendResult> {
  if (isBarberProvisioned()) {
    return { success: false, error: "whatsapp unavailable on this station" };
  }
  await activeDriver.disconnect();
  writeSessionState("unlinked");
  clearAttemptFields();
  return { success: true };
}

function stateFailureReason(state: WhatsAppSessionState): string {
  switch (state) {
    case "unlinked":
      return "whatsapp is not linked - pair with QR in Settings";
    case "linking":
      return "whatsapp linking in progress - finish pairing first";
    case "disconnected":
      return "whatsapp disconnected - no internet, try again once connected";
    case "relink-required":
      return "whatsapp session re-link required";
    default:
      return "whatsapp is not ready";
  }
}

// Owner/manager. Reads the authoritative daily_closings row by id, builds the
// message in main and sends to the stored owner number. The renderer only
// supplies the closing id and never any financial figure.
export async function sendWhatsAppClosing(
  closingId: number,
): Promise<SendResult & { sentTo?: string }> {
  if (isBarberProvisioned()) {
    return { success: false, error: "whatsapp unavailable on this station" };
  }
  const number = getStoredOwnerNumber();
  if (!number) {
    const result: SendResult = { success: false, error: "owner whatsapp number not configured" };
    recordAttempt(false, result.error ?? null);
    return result;
  }
  const state = readSessionState();
  if (state !== "ready") {
    const result: SendResult = { success: false, error: stateFailureReason(state) };
    recordAttempt(false, result.error ?? null);
    return result;
  }
  const closingRow = readClosing(closingId);
  if (!closingRow) {
    const result: SendResult = { success: false, error: "closing report not found" };
    recordAttempt(false, result.error ?? null);
    return result;
  }
  const stationLabel =
    (runOne("SELECT label FROM stations WHERE id = ?", [closingRow.stationId])?.[0] as
      string | null) || `Station ${closingRow.stationId}`;
  const closerName =
    (runOne("SELECT username FROM users WHERE id = ?", [closingRow.closedBy])?.[0] as
      string | null) || `user:${closingRow.closedBy}`;
  const text = buildClosingMessage(closingRow, { stationLabel, closerName });
  try {
    await activeDriver.sendText(`${number}@c.us`, text);
    const result: SendResult & { sentTo?: string } = {
      success: true,
      sentTo: maskWhatsAppNumber(number),
    };
    recordAttempt(true, null);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "send failed";
    const result: SendResult = { success: false, error: message };
    recordAttempt(false, message);
    return result;
  }
}

function readClosing(closingId: number): DailyClosingRecord | null {
  const row = runOne("SELECT * FROM daily_closings WHERE id = ?", [closingId]);
  if (!row) return null;
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
