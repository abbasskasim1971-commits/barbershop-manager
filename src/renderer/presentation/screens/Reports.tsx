import React from "react";
import { useTranslation } from "react-i18next";

const Reports: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="screen reports">
      <h1>{t("reports")}</h1>
      <p>{t("noData")}</p>
    </div>
  );
};

export default Reports;
