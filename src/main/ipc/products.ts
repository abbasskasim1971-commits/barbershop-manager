import { ipcMain } from 'electron';
import {
  requireAuth,
  getUtcNow,
  runOne,
  runSql,
  runQuery,
  addAuditLog,
  logSystemEvent,
  mapProducts,
  rowToProduct,
} from '../database';
import type { BindParams } from 'sql.js';

export function registerProductHandlers(): void {
  ipcMain.handle('products:getAll', async (_event, sessionId: string, limit = 100, offset = 0, includeDeleted = false) => {
    const session = requireAuth(sessionId, ['owner', 'manager']);
    if (!session) return [];
    const whereClause = includeDeleted ? "" : "WHERE is_deleted = 0";
    return mapProducts(runQuery(`SELECT * FROM products ${whereClause} ORDER BY name LIMIT ? OFFSET ?`, [limit, offset] as BindParams));
  });

  ipcMain.handle('products:getLowStock', async (_event, sessionId: string) => {
    const session = requireAuth(sessionId, ['owner', 'manager']);
    if (!session) return [];
    return mapProducts(runQuery('SELECT * FROM products WHERE quantity < low_stock_threshold AND is_deleted = 0'));
  });

  ipcMain.handle('products:getById', async (_event, sessionId: string, id: number) => {
    const session = requireAuth(sessionId, ['owner', 'manager']);
    if (!session) return undefined;
    const row = runOne("SELECT * FROM products WHERE id = ?", [id] as BindParams);
    return row ? rowToProduct(row) : undefined;
  });

  ipcMain.handle('products:getActive', async (_event, sessionId: string) => {
    const session = requireAuth(sessionId, ['owner', 'manager']);
    if (!session) return [];
    return mapProducts(runQuery('SELECT * FROM products WHERE is_deleted = 0 ORDER BY name'));
  });

  ipcMain.handle('products:getLowStockCount', async (_event, sessionId: string) => {
    const session = requireAuth(sessionId, ['owner', 'manager']);
    if (!session) return 0;
    const result = runQuery('SELECT COUNT(*) as count FROM products WHERE quantity < low_stock_threshold AND is_deleted = 0');
    return (result[0]?.[0] as number) || 0;
  });

  ipcMain.handle('products:create', async (_event, sessionId: string, name: string, price: number, costPrice: number, quantity: number, lowStockThreshold: number) => {
    const session = requireAuth(sessionId, ['owner', 'manager']);
    if (!session) return { success: false, error: 'Unauthorized' };

    if (!name || !name.trim()) {
      return { success: false, error: 'Product name is required' };
    }
    if (price < 0) {
      return { success: false, error: 'Selling price cannot be negative' };
    }
    if (costPrice < 0) {
      return { success: false, error: 'Cost price cannot be negative' };
    }
    if (quantity < 0) {
      return { success: false, error: 'Quantity cannot be negative' };
    }
    if (lowStockThreshold < 0) {
      return { success: false, error: 'Low stock threshold cannot be negative' };
    }

    const now = getUtcNow();
    const result = runSql(
      'INSERT INTO products (name, price, cost_price, quantity, low_stock_threshold, is_deleted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [name.trim(), price, costPrice, quantity, lowStockThreshold, 0, now, now] as BindParams
    );

    addAuditLog('products', result.lastInsertRowid, 'name', null, name.trim(), `user:${session.userId}`);
    addAuditLog('products', result.lastInsertRowid, 'price', null, String(price), `user:${session.userId}`);
    addAuditLog('products', result.lastInsertRowid, 'cost_price', null, String(costPrice), `user:${session.userId}`);
    addAuditLog('products', result.lastInsertRowid, 'quantity', null, String(quantity), `user:${session.userId}`);
    addAuditLog('products', result.lastInsertRowid, 'low_stock_threshold', null, String(lowStockThreshold), `user:${session.userId}`);

    return { success: true, id: result.lastInsertRowid };
  });

  ipcMain.handle('products:update', async (_event, sessionId: string, id: number, name: string, price: number, costPrice: number, quantity: number, lowStockThreshold: number) => {
    const session = requireAuth(sessionId, ['owner', 'manager']);
    if (!session) return { success: false, error: 'Unauthorized' };

    if (!name || !name.trim()) {
      return { success: false, error: 'Product name is required' };
    }
    if (price < 0) {
      return { success: false, error: 'Selling price cannot be negative' };
    }
    if (costPrice < 0) {
      return { success: false, error: 'Cost price cannot be negative' };
    }
    if (quantity < 0) {
      return { success: false, error: 'Quantity cannot be negative' };
    }
    if (lowStockThreshold < 0) {
      return { success: false, error: 'Low stock threshold cannot be negative' };
    }

    const oldProduct = runOne("SELECT * FROM products WHERE id = ?", [id] as BindParams);
    if (!oldProduct) {
      return { success: false, error: 'Product not found' };
    }

    const result = runSql(
      'UPDATE products SET name = ?, price = ?, cost_price = ?, quantity = ?, low_stock_threshold = ?, updated_at = ? WHERE id = ?',
      [name.trim(), price, costPrice, quantity, lowStockThreshold, getUtcNow(), id] as BindParams
    );

    const oldName = oldProduct[1] as string;
    const oldPrice = oldProduct[2] as number;
    const oldCost = oldProduct[3] as number;
    const oldQty = oldProduct[4] as number;
    const oldThreshold = oldProduct[5] as number;
    addAuditLog('products', id, 'name', oldName, name.trim(), `user:${session.userId}`);
    addAuditLog('products', id, 'price', String(oldPrice), String(price), `user:${session.userId}`);
    addAuditLog('products', id, 'cost_price', String(oldCost), String(costPrice), `user:${session.userId}`);
    addAuditLog('products', id, 'quantity', String(oldQty), String(quantity), `user:${session.userId}`);
    addAuditLog('products', id, 'low_stock_threshold', String(oldThreshold), String(lowStockThreshold), `user:${session.userId}`);

    return { success: true, changes: result.changes };
  });

  ipcMain.handle('products:delete', async (_event, sessionId: string, id: number) => {
    const session = requireAuth(sessionId, ['owner', 'manager']);
    if (!session) return { success: false, error: 'Unauthorized' };

    const oldProduct = runOne("SELECT * FROM products WHERE id = ?", [id] as BindParams);
    if (!oldProduct) {
      return { success: false, error: 'Product not found' };
    }

    const result = runSql('UPDATE products SET is_deleted = 1 WHERE id = ?', [id] as BindParams);

    addAuditLog('products', id, 'is_deleted', '0', '1', `user:${session.userId}`);

    return { success: true, changes: result.changes };
  });

  ipcMain.handle('products:updateStock', async (_event, sessionId: string, productId: number, newQuantity: number) => {
    const session = requireAuth(sessionId, ['owner', 'manager']);
    if (!session) return { success: false, error: 'Unauthorized' };

    if (newQuantity < 0) {
      return { success: false, error: 'Quantity cannot be negative' };
    }

    const oldProduct = runOne("SELECT * FROM products WHERE id = ?", [productId] as BindParams);
    if (!oldProduct) {
      return { success: false, error: 'Product not found' };
    }

    const oldQty = oldProduct[4] as number;
    const result = runSql('UPDATE products SET quantity = ?, updated_at = ? WHERE id = ?', [newQuantity, getUtcNow(), productId] as BindParams);

    addAuditLog('products', productId, 'quantity', String(oldQty), String(newQuantity), `user:${session.userId}`);

    return { success: true, changes: result.changes };
  });

  ipcMain.handle('products:addStock', async (_event, sessionId: string, productId: number, quantity: number) => {
    const session = requireAuth(sessionId, ['owner', 'manager']);
    if (!session) return { success: false, error: 'Unauthorized' };

    if (quantity <= 0) {
      return { success: false, error: 'Quantity to add must be greater than zero' };
    }

    const oldProduct = runOne('SELECT * FROM products WHERE id = ?', [productId] as BindParams);
    if (!oldProduct) {
      return { success: false, error: 'Product not found' };
    }

    const oldQty = oldProduct[4] as number;
    const newQty = oldQty + quantity;
    runSql('UPDATE products SET quantity = ?, updated_at = ? WHERE id = ?', [newQty, getUtcNow(), productId] as BindParams);

    addAuditLog('products', productId, 'quantity', String(oldQty), String(newQty), `user:${session.userId}`);
    logSystemEvent('inventory_added', `Added ${quantity} to product ${oldProduct[1] as string} (qty: ${newQty})`, 1);

    return { success: true, oldQuantity: oldQty, newQuantity: newQty };
  });

  ipcMain.handle('products:removeStock', async (_event, sessionId: string, productId: number, quantity: number) => {
    const session = requireAuth(sessionId, ['owner', 'manager']);
    if (!session) return { success: false, error: 'Unauthorized' };

    if (quantity <= 0) {
      return { success: false, error: 'Quantity to remove must be greater than zero' };
    }

    const oldProduct = runOne('SELECT * FROM products WHERE id = ?', [productId] as BindParams);
    if (!oldProduct) {
      return { success: false, error: 'Product not found' };
    }

    const oldQty = oldProduct[4] as number;
    if (oldQty < quantity) {
      return { success: false, error: 'Cannot remove more stock than available' };
    }

    const newQty = oldQty - quantity;
    runSql('UPDATE products SET quantity = ?, updated_at = ? WHERE id = ?', [newQty, getUtcNow(), productId] as BindParams);

    addAuditLog('products', productId, 'quantity', String(oldQty), String(newQty), `user:${session.userId}`);
    logSystemEvent('inventory_removed', `Removed ${quantity} from product ${oldProduct[1] as string} (qty: ${newQty})`, 1);

    return { success: true, oldQuantity: oldQty, newQuantity: newQty };
  });
}
