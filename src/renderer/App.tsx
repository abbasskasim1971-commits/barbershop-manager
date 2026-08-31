import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import Navigation from "./presentation/components/Navigation";
import Dashboard from "./presentation/screens/Dashboard";
import Pos from "./presentation/screens/Pos";
import Inventory from "./presentation/screens/Inventory";
import Expenses from "./presentation/screens/Expenses";
import Reports from "./presentation/screens/Reports";
import Settings from "./presentation/screens/Settings";

type Screen = "dashboard" | "pos" | "inventory" | "expenses" | "reports" | "settings";

const screenComponents: Record<Screen, React.FC> = {
  dashboard: Dashboard,
  pos: Pos,
  inventory: Inventory,
  expenses: Expenses,
  reports: Reports,
  settings: Settings,
};

const App: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [currentScreen, setCurrentScreen] = useState<Screen>("dashboard");
  const [isRTL, setIsRTL] = useState(true);

  useEffect(() => {
    document.dir = isRTL ? "rtl" : "ltr";
  }, [isRTL]);

  const handleLanguageChange = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  const CurrentScreen = screenComponents[currentScreen];

  return (
    <div className="app" dir={isRTL ? "rtl" : "ltr"}>
      <Navigation currentScreen={currentScreen} onScreenChange={setCurrentScreen} t={t} />
      <main className="main-content">
        <CurrentScreen />
      </main>
      <div className="language-switcher">
        <button onClick={() => handleLanguageChange("ar")}>AR</button>
        <button onClick={() => handleLanguageChange("ckb")}>CKB</button>
        <button onClick={() => setIsRTL(!isRTL)}>{isRTL ? "LTR" : "RTL"}</button>
      </div>
    </div>
  );
};

export default App;
