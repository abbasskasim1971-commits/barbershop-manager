import React from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";

const Reports: React.FC = () => {
  const { t } = useTranslation();
  const { canAccessReports } = useAuth();

  if (!canAccessReports()) {
    return (
      <div className="screen reports">
        <h1>{t("reports")}</h1>
        <p className="access-denied">{t("accessDenied")}</p>
      </div>
    );
  }

  return (
    <div className="screen reports">
      <h1>{t("reports")}</h1>
      <p>{t("noData")}</p>
    </div>
  );
};

export default Reports;
