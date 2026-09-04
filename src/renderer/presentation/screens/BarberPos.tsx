import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import { createSale, getServices } from "../../application/saleService";

interface PosService {
  id: number;
  name: string;
  price: number;
}

interface CartLine {
  key: string;
  serviceId: number;
  name: string;
  price: number;
  quantity: number;
}

const BarberPos: React.FC = () => {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const [services, setServices] = useState<PosService[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    const loadServices = async () => {
      try {
        const svc = await getServices();
        setServices(svc);
      } catch {
        setError(t("failedToLoad"));
      }
    };
    loadServices();
  }, [t]);

  const barberName = user?.username || "";

  const addService = (service: PosService) => {
    setError("");
    setSuccess("");
    setCart((prev) => {
      const existing = prev.find((l) => l.serviceId === service.id);
      if (existing) {
        return prev.map((l) =>
          l.serviceId === service.id ? { ...l, quantity: l.quantity + 1 } : l,
        );
      }
      return [
        ...prev,
        {
          key: `svc-${service.id}`,
          serviceId: service.id,
          name: service.name,
          price: service.price,
          quantity: 1,
        },
      ];
    });
  };

  const removeLine = (key: string) => {
    setCart((prev) => prev.filter((l) => l.key !== key));
  };

  const changeQuantity = (key: string, qty: number) => {
    if (qty <= 0) return;
    setCart((prev) => prev.map((l) => (l.key === key ? { ...l, quantity: qty } : l)));
  };

  const totalAmount = cart.reduce((sum, l) => sum + l.price * l.quantity, 0);

  const handleCheckout = async () => {
    if (cart.length === 0) {
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

    const lines = cart.map((l) => ({
      type: "service" as const,
      itemId: l.serviceId,
      name: l.name,
      quantity: l.quantity,
    }));

    try {
      const result = await createSale(user?.id || 0, 1, lines);
      if (result.success) {
        setSuccess(t("saleCompleted"));
        setCart([]);
      } else {
        setError(result.error || t("operationFailed"));
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <div className="screen barber-pos">
      <div className="barber-pos-header">
        <h1>{t("barberPos")}</h1>
        <div className="barber-pos-user">
          <span>{barberName}</span>
          <button className="btn btn-sm btn-outline" onClick={() => logout()}>
            {t("logout")}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="barber-pos-layout">
        <div className="barber-pos-catalog">
          <div className="catalog-section">
            <h2>{t("services")}</h2>
            <div className="item-grid barber-item-grid">
              {services.map((svc) => (
                <button
                  key={svc.id}
                  className="catalog-item barber-catalog-item"
                  onClick={() => addService(svc)}
                >
                  <div className="item-name">{svc.name}</div>
                  <div className="item-price">{svc.price.toLocaleString()} IQD</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="barber-pos-cart">
          <h2>{t("cart")}</h2>
          {cart.length === 0 ? (
            <p className="no-data">{t("noData")}</p>
          ) : (
            <ul className="barber-cart-lines">
              {cart.map((line) => (
                <li key={line.key} className="barber-cart-line">
                  <div className="barber-cart-line-info">
                    <div className="barber-cart-line-name">{line.name}</div>
                    <div className="barber-cart-line-price">
                      {line.price.toLocaleString()} IQD × {line.quantity}
                    </div>
                  </div>
                  <div className="barber-cart-line-actions">
                    <button
                      className="barber-qty-btn"
                      onClick={() => changeQuantity(line.key, line.quantity + 1)}
                    >
                      +
                    </button>
                    <button
                      className="barber-qty-btn"
                      onClick={() => changeQuantity(line.key, line.quantity - 1)}
                    >
                      −
                    </button>
                    <button className="btn btn-sm btn-danger" onClick={() => removeLine(line.key)}>
                      {t("remove")}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="barber-pos-totals">
            <div className="totals-row totals-grand">
              <span>{t("total")}:</span>
              <span className="barber-pos-grand-total">{totalAmount.toLocaleString()} IQD</span>
            </div>
          </div>

          <button
            className="btn btn-primary btn-block barber-checkout-btn"
            onClick={handleCheckout}
            disabled={cart.length === 0 || submitting}
          >
            {t("confirmSale")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BarberPos;
