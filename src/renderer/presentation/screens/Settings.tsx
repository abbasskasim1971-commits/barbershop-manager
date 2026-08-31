import React from "react";
import { useTranslation } from "react-i18next";

const Settings: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="screen settings">
      <h1>{t("settings")}</h1>
      <p>{t("noData")}</p>
    </div>
  );
};

export default Settings;
