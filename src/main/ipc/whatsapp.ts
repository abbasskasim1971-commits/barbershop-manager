import { ipcMain } from "electron";
import { addAuditLog, getDeviceStationId, logSystemEvent, requireAuth } from "../database";
import {
  beginWhatsAppLink,
  getWhatsAppStatus,
  sendWhatsAppClosing,
  stopWhatsAppLink,
  storeOwnerNumber,
} from "../whatsapp/client";
import { normalizeWhatsAppNumber } from "../whatsapp/number";

export function registerWhatsAppHandlers(): void {
  ipcMain.handle("whatsapp:getConfig", async (_event, sessionId: string) => {
    const session = requireAuth(sessionId, ["owner", "manager"]);
    if (!session) {
      return { available: false, configured: false, numberMasked: null, state: "unlinked" };
    }
    return getWhatsAppStatus();
  });

  ipcMain.handle(
    "whatsapp:setOwnerNumber",
    async (_event, sessionId: string, rawNumber: string) => {
      const session = requireAuth(sessionId, ["owner"]);
      if (!session) {
        return { success: false, error: "unauthorized" };
      }
      const digits = normalizeWhatsAppNumber(rawNumber);
      if (!digits) {
        return { success: false, error: "invalid whatsapp number" };
      }
      storeOwnerNumber(digits);
      addAuditLog(
        "app_settings",
        0,
        "whatsapp_owner_number",
        null,
        "configured",
        `user:${session.userId}`,
      );
      logSystemEvent(
        "whatsapp_number_configured",
        "Owner WhatsApp number configured",
        getDeviceStationId(),
      );
      return { success: true, status: getWhatsAppStatus() };
    },
  );

  ipcMain.handle("whatsapp:beginLink", async (_event, sessionId: string) => {
    const session = requireAuth(sessionId, ["owner"]);
    if (!session) return { success: false, error: "unauthorized" };
    const result = await beginWhatsAppLink();
    logSystemEvent(
      "whatsapp_link_attempt",
      result.success ? "WhatsApp linking started" : "WhatsApp linking unavailable",
      getDeviceStationId(),
    );
    return result;
  });

  ipcMain.handle("whatsapp:stopLink", async (_event, sessionId: string) => {
    const session = requireAuth(sessionId, ["owner"]);
    if (!session) return { success: false, error: "unauthorized" };
    const result = await stopWhatsAppLink();
    logSystemEvent(
      "whatsapp_unlink",
      result.success ? "WhatsApp session cleared" : "WhatsApp reset failed",
      getDeviceStationId(),
    );
    return result;
  });

  ipcMain.handle("whatsapp:sendClosing", async (_event, sessionId: string, closingId: number) => {
    const session = requireAuth(sessionId, ["owner", "manager"]);
    if (!session) return { success: false, error: "unauthorized" };
    if (!Number.isInteger(closingId) || closingId < 1) {
      return { success: false, error: "invalid closing report id" };
    }
    const result = await sendWhatsAppClosing(closingId);
    addAuditLog(
      "daily_closings",
      closingId,
      "whatsapp_send",
      null,
      result.success ? "sent" : "failed",
      `user:${session.userId}`,
    );
    logSystemEvent(
      "whatsapp_send",
      result.success
        ? `EOD report ${closingId} sent via WhatsApp`
        : `EOD report ${closingId} WhatsApp send failed`,
      getDeviceStationId(),
    );
    return result;
  });
}
