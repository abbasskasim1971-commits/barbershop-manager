import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import {
  getServices,
  getProducts,
  getBarbers,
  createSale,
  correctSale,
} from "../../application/saleService";

interface PosProduct {
  id: number;
  name: string;
  price: number;
  quantity: number;
  lowStockThreshold: number;
}

interface PosService {
  id: number;
  name: string;
  price: number;
}

interface PosBarber {
  id: number;
  username: string;
}

type PosLineType = "service" | "product";

interface PosLine {
  id: string;
  type: PosLineType;
  itemId: number;
  name: string;
  price: number;
  quantity: number;
}

const Pos: React.FC = () => {
  const { t } = useTranslation();
  const { canAccessPos } = useAuth();
  const [services, setServices] = useState<PosService[]>([]);
  const [products, setProducts] = useState<PosProduct[]>([]);
  const [barbers, setBarbers] = useState<PosBarber[]>([]);
  const [saleLines, setSaleLines] = useState<PosLine[]>([]);
  const [selectedBarber, setSelectedBarber] = useState<number>(0);
const [error, setError] = useState("");
const [success, setSuccess] = useState("");
const [submitting, setSubmitting] = useState(false);
const submittingRef = useRef(false);
const [showCorrection, setShowCorrection] = useState(false);
  const [correctionSaleId, setCorrectionSaleId] = useState("");

  useEffect(() => {
    const loadCatalog = async () => {
      try {
        const [svcRes, prodRes, brbRes] = await Promise.all([
          getServices(),
          getProducts(),
          getBarbers(),
        ]);
        setServices(svcRes);
        setProducts(prodRes);
        setBarbers(brbRes);
      } catch {
        setError(t("failedToLoad"));
      }
    };
    loadCatalog();
  }, []);

  const addServiceToSale = (service: PosService) => {
    const newLine: PosLine = {
      id: `svc-${service.id}-${Date.now()}`,
      type: "service",
      itemId: service.id,
      name: service.name,
      price: service.price,
      quantity: 1,
    };
    setSaleLines([...saleLines, newLine]);
  };

  const addProductToSale = (product: PosProduct) => {
    if (product.quantity <= 0) {
      setError(`${t("insufficientStock")} - ${product.name}`);
      return;
    }
    const newLine: PosLine = {
      id: `prod-${product.id}-${Date.now()}`,
      type: "product",
      itemId: product.id,
      name: product.name,
      price: product.price,
      quantity: 1,
    };
    setSaleLines([...saleLines, newLine]);
  };

  const removeLine = (lineId: string) => {
    setSaleLines(saleLines.filter((l) => l.id !== lineId));
  };

  const changeQuantity = (lineId: string, qty: number) => {
    setSaleLines(
      saleLines.map((l) => (l.id === lineId ? { ...l, quantity: Math.max(1, qty) } : l)),
    );
  };

  const calculateTotals = () => {
    let serviceTotal = 0;
    let productTotal = 0;
    for (const line of saleLines) {
      const lineTotal = line.price * line.quantity;
      if (line.type === "service") {
        serviceTotal += lineTotal;
      } else {
        productTotal += lineTotal;
      }
    }
    const totalAmount = serviceTotal + productTotal;
    return { serviceTotal, productTotal, totalAmount };
  };

  const handleCheckout = async () => {
    if (saleLines.length === 0) {
      setError(t("addItemsBeforeCheckout"));
      return;
    }
    if (submittingRef.current) {
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    setError("");
    setSuccess("");

    const lines = saleLines.map((l) => ({
      type: l.type,
      itemId: l.itemId,
      name: l.name,
      quantity: l.quantity,
    }));

    try {
      const result = await createSale(selectedBarber, 1, lines);
      if (result.success) {
        setSuccess(t("saleCompleted"));
        setSaleLines([]);
        setSelectedBarber(0);
      } else {
        setError(result.error || t("operationFailed"));
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const handleCorrection = async () => {
    const saleId = parseInt(correctionSaleId);
    if (isNaN(saleId) || saleId <= 0) {
      setError(t("invalidSaleId"));
      return;
    }
    setError("");
    setSuccess("");
    const result = await correctSale(saleId);
    if (result.success) {
      setSuccess(t("saleCorrected"));
      setShowCorrection(false);
      setCorrectionSaleId("");
    } else {
      setError(result.error || t("operationFailed"));
    }
  };

  const { serviceTotal, productTotal, totalAmount } = calculateTotals();

  if (!canAccessPos()) {
    return (
      <div className="screen pos">
        <h1>{t("pos")}</h1>
        <p className="access-denied">{t("accessDenied")}</p>
      </div>
    );
  }

  return (
    <div className="screen pos">
      <div className="screen-header">
        <h1>{t("pos")}</h1>
        <div className="header-actions">
          <button className="btn btn-sm btn-outline" onClick={() => setShowCorrection(true)}>
            {t("correctSale")}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {showCorrection && (
        <div className="form-modal">
          <h2>{t("correctSale")}</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleCorrection();
            }}
          >
            <div className="form-group">
              <label htmlFor="saleIdToCorrect">{t("saleId")}</label>
              <input
                id="saleIdToCorrect"
                type="number"
                value={correctionSaleId}
                onChange={(e) => setCorrectionSaleId(e.target.value)}
                required
                min="1"
                placeholder={t("saleIdPlaceholder")}
                autoFocus
              />
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-danger">
                {t("correct")}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setShowCorrection(false);
                  setCorrectionSaleId("");
                }}
              >
                {t("cancel")}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="pos-layout">
        <div className="pos-catalog">
          <div className="catalog-section">
            <h2>{t("services")}</h2>
            <div className="item-grid">
              {services.map((svc) => (
                <button key={svc.id} className="catalog-item" onClick={() => addServiceToSale(svc)}>
                  <div className="item-name">{svc.name}</div>
                  <div className="item-price">{svc.price.toLocaleString()} IQD</div>
                </button>
              ))}
            </div>
          </div>

          <div className="catalog-section">
            <h2>{t("products")}</h2>
            <div className="item-grid">
              {products.map((prod) => (
                <button
                  key={prod.id}
                  className="catalog-item"
                  onClick={() => addProductToSale(prod)}
                  disabled={prod.quantity <= 0}
                >
                  <div className="item-name">{prod.name}</div>
                  <div className="item-price">{prod.price.toLocaleString()} IQD</div>
                  <div className="item-stock">
                    {prod.quantity > 0 ? `${t("inStock")}: ${prod.quantity}` : t("outOfStock")}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="pos-sale">
          <div className="sale-barber">
            <label htmlFor="barberSelect">{t("barber")}</label>
            <select
              id="barberSelect"
              value={selectedBarber}
              onChange={(e) => setSelectedBarber(Number(e.target.value))}
            >
              <option value={0}>{t("noBarber")}</option>
              {barbers.map((barber) => (
                <option key={barber.id} value={barber.id}>
                  {barber.username}
                </option>
              ))}
            </select>
          </div>

          <table className="data-table sale-lines-table">
            <thead>
              <tr>
                <th>{t("type")}</th>
                <th>{t("item")}</th>
                <th>{t("price")}</th>
                <th>{t("quantity")}</th>
                <th>{t("lineTotal")}</th>
                <th>{t("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {saleLines.map((line) => (
                <tr
                  key={line.id}
                  className={line.type === "service" ? "service-line" : "product-line"}
                >
                  <td>{line.type === "service" ? t("service") : t("product")}</td>
                  <td>{line.name}</td>
                  <td>{line.price.toLocaleString()} IQD</td>
                  <td>
                    <input
                      type="number"
                      min="1"
                      value={line.quantity}
                      onChange={(e) => changeQuantity(line.id, Number(e.target.value))}
                      className="qty-input"
                    />
                  </td>
                  <td>{(line.price * line.quantity).toLocaleString()} IQD</td>
                  <td>
                    <button className="btn btn-sm btn-danger" onClick={() => removeLine(line.id)}>
                      {t("remove")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="sale-totals">
            <div className="totals-row">
              <span>{t("serviceTotal")}:</span>
              <span>{serviceTotal.toLocaleString()} IQD</span>
            </div>
            <div className="totals-row">
              <span>{t("productTotal")}:</span>
              <span>{productTotal.toLocaleString()} IQD</span>
            </div>
            <div className="totals-row totals-grand">
              <span>{t("total")}:</span>
              <span>{totalAmount.toLocaleString()} IQD</span>
            </div>
            <div className="totals-row">
              <span>{t("cashAmount")}:</span>
              <span>{totalAmount.toLocaleString()} IQD</span>
            </div>
          </div>

          <button
            className="btn btn-primary btn-block"
            onClick={handleCheckout}
            disabled={saleLines.length === 0 || submitting}
          >
            {t("confirmSale")}
          </button>
        </div>
      </div>

      {saleLines.length === 0 && <p className="no-data">{t("noData")}</p>}
    </div>
  );
};

export default Pos;
