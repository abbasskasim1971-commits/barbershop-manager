import type { DailyClosingRecord } from "../database";

export interface ClosingMessageContext {
  stationLabel: string;
  closerName: string;
}

export function buildClosingMessage(
  closing: DailyClosingRecord,
  context: ClosingMessageContext,
): string {
  const lines = [
    "END OF DAY REPORT",
    `Date: ${closing.businessDate}`,
    `Station: ${context.stationLabel}`,
    `Expected Cash: ${closing.expectedCash} IQD`,
    `Counted Cash: ${closing.countedCash} IQD`,
    `Difference: ${closing.difference} IQD`,
    `Expenses: ${closing.expenseTotal} IQD`,
    `Closed By: ${context.closerName}`,
    `Closed At (UTC): ${closing.closedAt}`,
  ];
  return lines.join("\n");
}
