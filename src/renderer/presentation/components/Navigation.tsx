import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { getLowStockCount } from "../../application/inventoryService";

type Screen =
  | "dashboard"
  | "pos"
  | "inventory"
  | "expenses"
  | "reports"
  | "settings"
  | "userManagement"
  | "services"
  | "products"
  | "expenseCategories"
  | "commissionManagement"
  | "eod";

interface NavigationProps {
  currentScreen: Screen;
  onScreenChange: (screen: Screen) => void;
  tabs: { id: string; label: string; permission: () => boolean }[];
  user: { id: number; username: string; role: string } | null;
  onLogout: () => void;
}

const Navigation: React.FC<NavigationProps> = ({
  currentScreen,
  onScreenChange,
  tabs,
  user,
  onLogout,
}) => {
  const { t } = useTranslation();
  const [lowStockCount, setLowStockCount] = useState(0);

  useEffect(() => {
    const fetchLowStockCount = async () => {
      try {
        const count = await getLowStockCount();
        setLowStockCount(count);
      } catch {
        setLowStockCount(0);
      }
    };
    fetchLowStockCount();
  }, []);

  return (
    <nav className="navigation">
      <ul className="nav-tabs">
        {tabs.map((tab) => (
          <li key={tab.id}>
            <button
              className={`nav-tab ${currentScreen === tab.id ? "active" : ""}`}
              onClick={() => onScreenChange(tab.id as Screen)}
            >
              {tab.label}
              {tab.id === "inventory" && lowStockCount > 0 && (
                <span className="nav-badge">{lowStockCount}</span>
              )}
            </button>
          </li>
        ))}
      </ul>
      <div className="nav-user">
        <span>
          {user?.username} ({user?.role})
        </span>
        <button onClick={onLogout} className="logout-btn">
          {t("logout")}
        </button>
      </div>
    </nav>
  );
};

export default Navigation;
