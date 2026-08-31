import {
  query,
  getOne,
  insert,
  softDelete,
  logEvent,
} from "../infrastructure/database/databaseService";

export async function getSale(id: number) {
  const result = await getOne("SELECT * FROM sales WHERE id = ? AND is_deleted = 0", [id]);
  return result;
}

export async function getAllSales(limit = 100, offset = 0) {
  return query(
    "SELECT * FROM sales WHERE is_deleted = 0 ORDER BY created_at DESC LIMIT ? OFFSET ?",
    [limit, offset],
  );
}

export async function createSale(data: {
  barberId: number;
  stationId: number;
  totalAmount: number;
  cashAmount: number;
  createdBy: number;
}) {
  const result = await insert("sales", {
    barber_id: data.barberId,
    station_id: data.stationId,
    total_amount: data.totalAmount,
    cash_amount: data.cashAmount,
    created_by: data.createdBy,
    is_deleted: 0,
  });
  await logEvent("sale_created", `Sale created: ${result.lastInsertRowid}`, data.stationId);
  return result;
}

export async function addSaleLine(
  saleId: number,
  type: "service" | "product",
  itemId: number,
  name: string,
  price: number,
  quantity: number,
) {
  const table = type === "service" ? "sale_service_lines" : "sale_product_lines";
  const lineTotal = price * quantity;
  const result = await insert(table, {
    sale_id: saleId,
    item_id: itemId,
    name,
    price,
    quantity,
    line_total: lineTotal,
  });
  return result;
}

export async function correctSale(saleId: number, barberId: number, stationId: number) {
  const sale = await getOne("SELECT * FROM sales WHERE id = ?", [saleId]);
  if (!sale || sale[5] === 1) {
    throw new Error("Sale not found");
  }

  await softDelete("sales", saleId);
  await logEvent("sale_corrected", `Sale corrected: ${saleId}`, stationId);
}

export async function getSalesForBarber(barberId: number, date: string) {
  return query(
    "SELECT * FROM sales WHERE barber_id = ? AND date(created_at) = ? AND is_deleted = 0",
    [barberId, date],
  );
}

export async function getCommissionForBarber(barberId: number, startDate: string, endDate: string) {
  return query(
    `SELECT s.id, s.total_amount, sl.service_id, sl.line_total, cr.rate
     FROM sales s
     JOIN sale_service_lines sl ON s.id = sl.sale_id
     JOIN commission_rates cr ON sl.service_id = cr.barber_id
     WHERE s.barber_id = ? AND s.created_at BETWEEN ? AND ? AND s.is_deleted = 0`,
    [barberId, startDate, endDate],
  );
}
