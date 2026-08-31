import { query, insert } from "../infrastructure/database/databaseService";

export async function getCommissionRate(barberId: number) {
  const rows = await query(
    "SELECT * FROM commission_rates WHERE barber_id = ? AND is_deleted = 0 ORDER BY effective_from DESC LIMIT 1",
    [barberId],
  );
  return rows?.[0];
}

export async function getCommissionDues(barberId: number, startDate: string, endDate: string) {
  const rows = await query(
    `SELECT s.id, s.total_amount, sl.line_total, cr.rate
     FROM sales s
     JOIN sale_service_lines sl ON s.id = sl.sale_id
     LEFT JOIN commission_rates cr ON cr.barber_id = s.barber_id
     WHERE s.barber_id = ? AND s.created_at BETWEEN ? AND ? AND s.is_deleted = 0`,
    [barberId, startDate, endDate],
  );
  let totalCommission = 0;
  for (const row of rows) {
    const lineTotal = row[2] as number;
    const rate = (row[3] as number) || 0;
    totalCommission += lineTotal * (rate / 100);
  }
  return totalCommission;
}

export async function setCommissionRate(barberId: number, rate: number) {
  const now = new Date().toISOString();
  await insert("commission_rates", {
    barber_id: barberId,
    rate,
    effective_from: now,
    is_deleted: 0,
  });
}
