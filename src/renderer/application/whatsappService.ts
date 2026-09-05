import { AuthService } from "./authService";

const api = window.whatsapp;

export interface WhatsAppSendResult {
  success: boolean;
  error?: string;
  sentTo?: string;
}

export async function getWhatsAppConfig() {
  const sessionId = AuthService.getSessionId() || "";
  return api.getConfig(sessionId);
}

export async function setWhatsAppOwnerNumber(rawNumber: string) {
  const sessionId = AuthService.getSessionId() || "";
  return api.setOwnerNumber(sessionId, rawNumber);
}

export async function beginWhatsAppLink() {
  const sessionId = AuthService.getSessionId() || "";
  return api.beginLink(sessionId);
}

export async function stopWhatsAppLink() {
  const sessionId = AuthService.getSessionId() || "";
  return api.stopLink(sessionId);
}

export async function sendWhatsAppClosing(closingId: number): Promise<WhatsAppSendResult> {
  const sessionId = AuthService.getSessionId() || "";
  return api.sendClosing(sessionId, closingId);
}
