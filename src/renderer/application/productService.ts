import {
  query,
  getOne,
  insert,
  update,
  softDelete,
} from "../infrastructure/database/databaseService";

export interface Product {
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

export async function getAllProducts(
  limit = 100,
  offset = 0,
  includeDeleted = false,
): Promise<Product[]> {
  const whereClause = includeDeleted ? "" : "WHERE is_deleted = 0";
  return query(`SELECT * FROM products ${whereClause} ORDER BY name LIMIT ? OFFSET ?`, [
    limit,
    offset,
  ]);
}

export async function getLowStockProducts(threshold = 5): Promise<Product[]> {
  return query("SELECT * FROM products WHERE quantity < ? AND is_deleted = 0", [threshold]);
}

export async function getProductById(id: number): Promise<Product | undefined> {
  return getOne("SELECT * FROM products WHERE id = ?", [id]);
}

export async function createProduct(
  name: string,
  price: number,
  costPrice: number,
  quantity: number,
  lowStockThreshold: number,
): Promise<{ changes: number; lastInsertRowid: number }> {
  if (!name || !name.trim()) {
    throw new Error("Product name is required");
  }
  if (price < 0) {
    throw new Error("Selling price cannot be negative");
  }
  if (costPrice < 0) {
    throw new Error("Cost price cannot be negative");
  }
  if (quantity < 0) {
    throw new Error("Quantity cannot be negative");
  }
  if (lowStockThreshold < 0) {
    throw new Error("Low stock threshold cannot be negative");
  }

  const result = await insert("products", {
    name: name.trim(),
    price,
    cost_price: costPrice,
    quantity,
    low_stock_threshold: lowStockThreshold,
    is_deleted: 0,
  });

  return result;
}

export async function updateProduct(
  id: number,
  name: string,
  price: number,
  costPrice: number,
  quantity: number,
  lowStockThreshold: number,
): Promise<{ changes: number }> {
  if (!name || !name.trim()) {
    throw new Error("Product name is required");
  }
  if (price < 0) {
    throw new Error("Selling price cannot be negative");
  }
  if (costPrice < 0) {
    throw new Error("Cost price cannot be negative");
  }
  if (quantity < 0) {
    throw new Error("Quantity cannot be negative");
  }
  if (lowStockThreshold < 0) {
    throw new Error("Low stock threshold cannot be negative");
  }

  return update("products", id, {
    name: name.trim(),
    price,
    cost_price: costPrice,
    quantity,
    low_stock_threshold: lowStockThreshold,
  });
}

export async function softDeleteProduct(id: number): Promise<{ changes: number }> {
  return softDelete("products", id);
}

export async function updateProductStock(
  productId: number,
  newQuantity: number,
): Promise<{ changes: number }> {
  if (newQuantity < 0) {
    throw new Error("Quantity cannot be negative");
  }
  return update("products", productId, { quantity: newQuantity });
}

export async function getLowStockCount(): Promise<number> {
  const result = await query(
    "SELECT COUNT(*) as count FROM products WHERE quantity <= low_stock_threshold AND is_deleted = 0",
  );
  return (result[0]?.[0] as number) || 0;
}
