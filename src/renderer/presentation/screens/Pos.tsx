import React from "react";
import { useTranslation } from "react-i18next";

const Pos: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="screen pos">
      <h1>{t("pos")}</h1>
      <p>{t("noData")}</p>
    </div>
  );
};

export default Pos;
