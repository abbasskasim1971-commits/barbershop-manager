const WHATSAPP_NUMBER_RE = /^[1-9]\d{7,14}$/;

export function normalizeWhatsAppNumber(input: string): string | null {
  if (typeof input !== "string") return null;
  const cleaned = input.replace(/[\s\-().]/g, "").replace(/^\+/, "");
  if (!WHATSAPP_NUMBER_RE.test(cleaned)) return null;
  return cleaned;
}

export function maskWhatsAppNumber(digits: string): string {
  const tail = digits.slice(-4);
  return "****".concat(tail);
}
