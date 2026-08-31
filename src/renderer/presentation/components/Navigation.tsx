import React from "react";

interface NavigationProps {
  currentScreen: string;
  onScreenChange: (screen: string) => void;
  t: (key: string) => string;
}

const Navigation: React.FC<NavigationProps> = ({ currentScreen, onScreenChange, t }) => {
  const tabs = [
    { id: "dashboard", label: t("dashboard") },
    { id: "pos", label: t("pos") },
    { id: "inventory", label: t("inventory") },
    { id: "expenses", label: t("expenses") },
    { id: "reports", label: t("reports") },
    { id: "settings", label: t("settings") },
  ];

  return (
    <nav className="navigation">
      <ul className="nav-tabs">
        {tabs.map((tab) => (
          <li key={tab.id}>
            <button
              className={`nav-tab ${currentScreen === tab.id ? "active" : ""}`}
              onClick={() => onScreenChange(tab.id)}
            >
              {tab.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default Navigation;
