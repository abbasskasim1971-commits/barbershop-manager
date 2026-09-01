import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import {
  getAllProducts,
  getLowStockProducts,
  addProductStock,
  removeProductStock,
  getLowStockCount,
} from "../../application/inventoryService";

interface Product {
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

type Tab = "all" | "lowStock";

const Inventory: React.FC = () => {
  const { t } = useTranslation();
  const { canAccessInventory } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [adjustmentProduct, setAdjustmentProduct] = useState<Product | null>(null);
  const [adjustmentType, setAdjustmentType] = useState<"add" | "remove">("add");
  const [adjustmentQty, setAdjustmentQty] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const loadInventory = async () => {
    try {
      const [all, lowStock, count] = await Promise.all([
        getAllProducts(100, 0),
        getLowStockProducts(),
        getLowStockCount(),
      ]);
      setProducts(all);
      setLowStockProducts(lowStock);
      setLowStockCount(count);
    } catch {
      setError(t("failedToLoad"));
    }
  };

  useEffect(() => {
    loadInventory();
  }, []);

  const openAdjustment = (product: Product, type: "add" | "remove") => {
    setAdjustmentProduct(product);
    setAdjustmentType(type);
    setAdjustmentQty("");
    setError("");
    setSuccess("");
  };

  const handleAdjustment = async () => {
    if (!adjustmentProduct) return;
    const qty = parseInt(adjustmentQty);
    if (isNaN(qty) || qty <= 0) {
      setError(t("invalidQuantity"));
      return;
    }
    setError("");
    setSuccess("");
    setIsLoading(true);
    try {
      const result =
        adjustmentType === "add"
          ? await addProductStock(adjustmentProduct.id, qty)
          : await removeProductStock(adjustmentProduct.id, qty);

      if (result.success) {
        setSuccess(adjustmentType === "add" ? t("stockAdded") : t("stockRemoved"));
        setAdjustmentProduct(null);
        setAdjustmentQty("");
        loadInventory();
      } else {
        setError(result.error || t("operationFailed"));
      }
    } catch {
      setError(t("operationFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  const displayedProducts = activeTab === "all" ? products : lowStockProducts;

  if (!canAccessInventory()) {
    return (
      <div className="screen inventory">
        <h1>{t("inventory")}</h1>
        <p className="access-denied">{t("accessDenied")}</p>
      </div>
    );
  }

  return (
    <div className="screen inventory">
      <div className="screen-header">
        <h1>{t("inventory")}</h1>
        {lowStockCount > 0 && (
          <span className="stock-alert-badge">
            {t("lowStockAlert")}: {lowStockCount}
          </span>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="tabs">
        <button
          className={`tab ${activeTab === "all" ? "active" : ""}`}
          onClick={() => setActiveTab("all")}
        >
          {t("allProducts")}
        </button>
        <button
          className={`tab ${activeTab === "lowStock" ? "active" : ""}`}
          onClick={() => setActiveTab("lowStock")}
        >
          {t("lowStock")} ({lowStockCount})
        </button>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t("name")}</th>
              <th>{t("quantity")}</th>
              <th>{t("lowStockThreshold")}</th>
              <th>{t("lowStockCount")}</th>
              <th>{t("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {displayedProducts.map((product) => (
              <tr
                key={product.id}
                className={
                  product.quantity < product.lowStockThreshold && !product.isDeleted
                    ? "low-stock"
                    : ""
                }
              >
                <td>{product.name}</td>
                <td
                  className={product.quantity < product.lowStockThreshold ? "low-stock-value" : ""}
                >
                  {product.quantity}
                </td>
                <td>{product.lowStockThreshold}</td>
                <td>
                  {product.quantity < product.lowStockThreshold
                    ? t("belowThreshold")
                    : t("inStock")}
                </td>
                <td>
                  <div className="action-buttons">
                    <button
                      className="btn btn-sm btn-success"
                      onClick={() => openAdjustment(product, "add")}
                      title={t("addStock")}
                    >
                      +
                    </button>
                    <button
                      className="btn btn-sm btn-warning"
                      onClick={() => openAdjustment(product, "remove")}
                      title={t("removeStock")}
                      disabled={product.quantity <= 0}
                    >
                      -
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {adjustmentProduct && (
        <div className="form-modal">
          <h2>
            {adjustmentType === "add" ? t("addStock") : t("removeStock")} — {adjustmentProduct.name}
          </h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAdjustment();
            }}
          >
            <div className="form-group">
              <label htmlFor="invAdjustmentQty">{t("quantity")}</label>
              <input
                id="invAdjustmentQty"
                type="number"
                value={adjustmentQty}
                onChange={(e) => setAdjustmentQty(e.target.value)}
                required
                min="1"
                step="1"
                placeholder={t("quantityPlaceholder")}
                autoFocus
              />
            </div>
            {adjustmentType === "remove" && (
              <p className="info-text">
                {t("currentStock")}: {adjustmentProduct.quantity}
              </p>
            )}
            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={isLoading}>
                {isLoading ? t("saving") : adjustmentType === "add" ? t("add") : t("remove")}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setAdjustmentProduct(null)}
              >
                {t("cancel")}
              </button>
            </div>
          </form>
        </div>
      )}

      {displayedProducts.length === 0 && <p className="no-data">{t("noData")}</p>}
    </div>
  );
};

export default Inventory;
