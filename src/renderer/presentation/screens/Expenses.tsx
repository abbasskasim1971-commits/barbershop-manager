import React from "react";
import { useTranslation } from "react-i18next";

const Expenses: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="screen expenses">
      <h1>{t("expenses")}</h1>
      <p>{t("noData")}</p>
    </div>
  );
};

export default Expenses;
