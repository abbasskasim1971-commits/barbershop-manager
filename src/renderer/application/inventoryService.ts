import { query, insert, update } from "../infrastructure/database/databaseService";

export async function getAllProducts(limit = 100, offset = 0) {
  return query("SELECT * FROM products WHERE is_deleted = 0 ORDER BY name LIMIT ? OFFSET ?", [
    limit,
    offset,
  ]);
}

export async function getLowStockProducts(threshold = 5) {
  return query("SELECT * FROM products WHERE quantity < ? AND is_deleted = 0", [threshold]);
}

export async function updateProductStock(productId: number, newQuantity: number) {
  return update("products", productId, { quantity: newQuantity });
}

export async function createProduct(data: {
  name: string;
  price: number;
  quantity: number;
  lowStockThreshold: number;
}) {
  return insert("products", { ...data, is_deleted: 0 });
}
