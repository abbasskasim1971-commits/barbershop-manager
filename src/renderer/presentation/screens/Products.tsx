import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import {
  getAllProducts,
  createProduct,
  updateProduct,
  softDeleteProduct,
  getLowStockCount,
} from "../../application/productService";

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

const Products: React.FC = () => {
  const { t } = useTranslation();
  const { canAccessProducts } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [lowStockThreshold, setLowStockThreshold] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [lowStockCount, setLowStockCount] = useState(0);

  const loadProducts = async () => {
    try {
      const result = await getAllProducts(100, 0, false);
      setProducts(result);
      const count = await getLowStockCount();
      setLowStockCount(count);
    } catch (error) {
      setError(t("failedToLoad"));
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsLoading(true);

    try {
      if (editingProduct) {
        const result = await updateProduct(
          editingProduct.id,
          name,
          parseInt(price) || 0,
          parseInt(costPrice) || 0,
          parseInt(quantity) || 0,
          parseInt(lowStockThreshold) || 0,
        );
        if (result.changes > 0) {
          setSuccess(t("productUpdated"));
          setEditingProduct(null);
        } else {
          setError(t("updateFailed"));
        }
      } else {
        const result = await createProduct(
          name,
          parseInt(price) || 0,
          parseInt(costPrice) || 0,
          parseInt(quantity) || 0,
          parseInt(lowStockThreshold) || 0,
        );
        if (result.lastInsertRowid) {
          setSuccess(t("productCreated"));
        } else {
          setError(t("createFailed"));
        }
      }
      setName("");
      setPrice("");
      setCostPrice("");
      setQuantity("");
      setLowStockThreshold("");
      setShowForm(false);
      loadProducts();
    } catch (error) {
      setError(t("operationFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setName(product.name);
    setPrice(product.price.toString());
    setCostPrice(product.costPrice.toString());
    setQuantity(product.quantity.toString());
    setLowStockThreshold(product.lowStockThreshold.toString());
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm(t("confirmDelete"))) return;

    try {
      const result = await softDeleteProduct(id);
      if (result.changes > 0) {
        setSuccess(t("productDeleted"));
        loadProducts();
      } else {
        setError(t("deleteFailed"));
      }
    } catch (error) {
      setError(t("deleteFailed"));
    }
  };

  const cancelEdit = () => {
    setEditingProduct(null);
    setName("");
    setPrice("");
    setCostPrice("");
    setQuantity("");
    setLowStockThreshold("");
    setShowForm(false);
  };

  if (!canAccessProducts()) {
    return (
      <div className="screen products">
        <h1>{t("products")}</h1>
        <p className="access-denied">{t("accessDenied")}</p>
      </div>
    );
  }

  return (
    <div className="screen products">
      <div className="screen-header">
        <h1>{t("products")}</h1>
        <div className="header-actions">
          {lowStockCount > 0 && (
            <span className="stock-alert">
              {t("lowStockAlert")}: {lowStockCount}
            </span>
          )}
          <button
            className="btn btn-primary"
            onClick={() => {
              setShowForm(true);
              setEditingProduct(null);
              setName("");
              setPrice("");
              setCostPrice("");
              setQuantity("");
              setLowStockThreshold("");
            }}
          >
            {t("add")}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {showForm && (
        <div className="form-modal">
          <h2>{editingProduct ? t("editProduct") : t("addProduct")}</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="name">{t("name")}</label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder={t("namePlaceholder")}
                />
              </div>
              <div className="form-group">
                <label htmlFor="price">{t("sellingPrice")} (IQD)</label>
                <input
                  id="price"
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  required
                  min="0"
                  step="1"
                  placeholder={t("pricePlaceholder")}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="costPrice">{t("costPrice")} (IQD)</label>
                <input
                  id="costPrice"
                  type="number"
                  value={costPrice}
                  onChange={(e) => setCostPrice(e.target.value)}
                  required
                  min="0"
                  step="1"
                  placeholder={t("costPricePlaceholder")}
                />
              </div>
              <div className="form-group">
                <label htmlFor="quantity">{t("quantity")}</label>
                <input
                  id="quantity"
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  required
                  min="0"
                  step="1"
                  placeholder={t("quantityPlaceholder")}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="lowStockThreshold">{t("lowStockThreshold")}</label>
                <input
                  id="lowStockThreshold"
                  type="number"
                  value={lowStockThreshold}
                  onChange={(e) => setLowStockThreshold(e.target.value)}
                  required
                  min="0"
                  step="1"
                  placeholder={t("thresholdPlaceholder")}
                />
              </div>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={isLoading}>
                {isLoading ? t("saving") : editingProduct ? t("update") : t("save")}
              </button>
              <button type="button" className="btn btn-secondary" onClick={cancelEdit}>
                {t("cancel")}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t("name")}</th>
              <th>{t("sellingPrice")}</th>
              <th>{t("costPrice")}</th>
              <th>{t("quantity")}</th>
              <th>{t("lowStockThreshold")}</th>
              <th>{t("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr
                key={product.id}
                className={
                  product.quantity <= product.lowStockThreshold && product.isDeleted === false
                    ? "low-stock"
                    : ""
                }
              >
                <td>{product.name}</td>
                <td>{product.price.toLocaleString()} IQD</td>
                <td>{product.costPrice.toLocaleString()} IQD</td>
                <td
                  className={product.quantity <= product.lowStockThreshold ? "low-stock-value" : ""}
                >
                  {product.quantity}
                </td>
                <td>{product.lowStockThreshold}</td>
                <td>
                  <div className="action-buttons">
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => handleEdit(product)}
                    >
                      {t("edit")}
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => handleDelete(product.id)}
                    >
                      {t("delete")}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {products.length === 0 && !showForm && <p className="no-data">{t("noData")}</p>}
    </div>
  );
};

export default Products;
