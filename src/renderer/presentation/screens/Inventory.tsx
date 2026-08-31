import React from "react";
import { useTranslation } from "react-i18next";

const Inventory: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="screen inventory">
      <h1>{t("inventory")}</h1>
      <p>{t("noData")}</p>
    </div>
  );
};

export default Inventory;
