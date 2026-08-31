import React from "react";
import { useTranslation } from "react-i18next";

const Dashboard: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="screen dashboard">
      <h1>{t("dashboard")}</h1>
      <div className="dashboard-grid">
        <div className="stat-card">
          <h3>{t("totalSales")}</h3>
          <p className="stat-value">0 IQD</p>
        </div>
        <div className="stat-card">
          <h3>{t("barbers")}</h3>
          <p className="stat-value">0</p>
        </div>
        <div className="stat-card">
          <h3>{t("stockAlert")}</h3>
          <p className="stat-value">0</p>
        </div>
      </div>
      <p>{t("noData")}</p>
    </div>
  );
};

export default Dashboard;
