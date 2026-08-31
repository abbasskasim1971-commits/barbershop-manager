const BAGHDAD_UTC_OFFSET_MS = 3 * 60 * 60 * 1000;

export function getBaghdadNow(): string {
  const now = new Date();
  const baghdadTime = new Date(now.getTime() + BAGHDAD_UTC_OFFSET_MS);
  return baghdadTime.toISOString();
}

export function toBaghdadTime(isoString: string): string {
  const date = new Date(isoString);
  const baghdadTime = new Date(date.getTime() + BAGHDAD_UTC_OFFSET_MS);
  return baghdadTime.toISOString();
}

export function formatBaghdadDateTime(isoString: string): string {
  const date = new Date(isoString);
  const baghdadTime = new Date(date.getTime() + BAGHDAD_UTC_OFFSET_MS);
  return baghdadTime.toLocaleString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function getBaghdadDate(): string {
  const now = new Date();
  const baghdadTime = new Date(now.getTime() + BAGHDAD_UTC_OFFSET_MS);
  return baghdadTime.toISOString().split("T")[0];
}
