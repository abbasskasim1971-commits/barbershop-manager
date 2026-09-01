import {
  query,
  getOne,
  insert,
  update,
  softDelete,
  logEvent,
} from "../infrastructure/database/databaseService";

export interface Service {
  id: number;
  name: string;
  description: string;
  price: number;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function getAllServices(
  limit = 100,
  offset = 0,
  includeDeleted = false,
): Promise<Service[]> {
  const whereClause = includeDeleted ? "" : "WHERE is_deleted = 0";
  return query(`SELECT * FROM services ${whereClause} ORDER BY name LIMIT ? OFFSET ?`, [
    limit,
    offset,
  ]);
}

export async function getServiceById(id: number): Promise<Service | undefined> {
  return getOne("SELECT * FROM services WHERE id = ?", [id]);
}

export async function createService(
  name: string,
  description: string,
  price: number,
): Promise<{ changes: number; lastInsertRowid: number }> {
  if (!name || !name.trim()) {
    throw new Error("Service name is required");
  }
  if (price < 0) {
    throw new Error("Price cannot be negative");
  }

  const result = await insert("services", {
    name: name.trim(),
    description: description?.trim() || "",
    price,
    is_deleted: 0,
  });

  await logEvent("service_created", `Service created: ${name} (${price} IQD)`, 1);

  return result;
}

export async function updateService(
  id: number,
  name: string,
  description: string,
  price: number,
  _sessionId: string,
): Promise<{ changes: number }> {
  if (!name || !name.trim()) {
    throw new Error("Service name is required");
  }
  if (price < 0) {
    throw new Error("Price cannot be negative");
  }

  const oldService = await getOne("SELECT * FROM services WHERE id = ?", [id]);
  if (!oldService) {
    throw new Error("Service not found");
  }

  const result = await update("services", id, {
    name: name.trim(),
    description: description?.trim() || "",
    price,
  });

  await logEvent(
    "service_updated",
    `Service updated: ${oldService[1] as string} -> ${name.trim()}`,
    1,
  );

  return result;
}

export async function softDeleteService(
  id: number,
  _sessionId: string,
): Promise<{ changes: number }> {
  const service = await getOne("SELECT * FROM services WHERE id = ?", [id]);
  if (!service) {
    throw new Error("Service not found");
  }

  const result = await softDelete("services", id);

  await logEvent("service_deleted", `Service deleted: ${service[1] as string}`, 1);

  return result;
}

export async function getActiveServices(): Promise<Service[]> {
  return query("SELECT * FROM services WHERE is_deleted = 0 ORDER BY name");
}
