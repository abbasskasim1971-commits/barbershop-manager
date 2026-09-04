import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { AuthProvider, useAuth } from "./presentation/hooks/useAuth";
import Navigation from "./presentation/components/Navigation";
import Login from "./presentation/screens/Login";
import Dashboard from "./presentation/screens/Dashboard";
import Pos from "./presentation/screens/Pos";
import Inventory from "./presentation/screens/Inventory";
import Expenses from "./presentation/screens/Expenses";
import Reports from "./presentation/screens/Reports";
import Settings from "./presentation/screens/Settings";
import UserManagement from "./presentation/screens/UserManagement";
import FirstRunSetup from "./presentation/screens/FirstRunSetup";
import Services from "./presentation/screens/Services";
import Products from "./presentation/screens/Products";
import ExpenseCategories from "./presentation/screens/ExpenseCategories";

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
  | "expenseCategories";

const screenComponents: Record<Screen, React.FC> = {
  dashboard: Dashboard,
  pos: Pos,
  inventory: Inventory,
  expenses: Expenses,
  reports: Reports,
  settings: Settings,
  userManagement: UserManagement,
  services: Services,
  products: Products,
  expenseCategories: ExpenseCategories,
};

function AppContent() {
  const { t, i18n } = useTranslation();
  const {
    user,
    isLoading,
    isAuthenticated,
    logout,
    canAccessUserManagement,
    canAccessReports,
    canAccessPos,
    canAccessServices,
    canAccessProducts,
    canAccessInventory,
    canAccessExpenseCategories,
    canAccessExpenses,
    canAccessSettings,
    checkOwnerExists,
  } = useAuth();
  const [currentScreen, setCurrentScreen] = useState<Screen>("dashboard");
  const [isRTL, setIsRTL] = useState(true);
  const [ownerExists, setOwnerExists] = useState(false);
  const [checkingOwner, setCheckingOwner] = useState(true);

  useEffect(() => {
    document.dir = isRTL ? "rtl" : "ltr";
  }, [isRTL]);

  useEffect(() => {
    const checkOwner = async () => {
      const result = await checkOwnerExists();
      setOwnerExists(result.exists);
      setCheckingOwner(false);
    };
    checkOwner();
  }, [checkOwnerExists]);

  const handleLanguageChange = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  const handleLogout = async () => {
    await logout();
  };

  if (isLoading || checkingOwner) {
    return (
      <div className="app" dir={isRTL ? "rtl" : "ltr"}>
        <div className="loading-screen">Loading...</div>
      </div>
    );
  }

  if (!ownerExists) {
    return <FirstRunSetup />;
  }

  if (!isAuthenticated()) {
    return <Login />;
  }

  const CurrentScreen = screenComponents[currentScreen];

  const tabs = [
    { id: "dashboard", label: t("dashboard"), permission: () => canAccessReports() },
    { id: "pos", label: t("pos"), permission: () => canAccessPos() },
    { id: "services", label: t("services"), permission: () => canAccessServices() },
    { id: "products", label: t("products"), permission: () => canAccessProducts() },
    { id: "inventory", label: t("inventory"), permission: () => canAccessInventory() },
    {
      id: "expenseCategories",
      label: t("expenseCategories"),
      permission: () => canAccessExpenseCategories(),
    },
    { id: "expenses", label: t("expenses"), permission: () => canAccessExpenses() },
    { id: "reports", label: t("reports"), permission: () => canAccessReports() },
    { id: "settings", label: t("settings"), permission: () => canAccessSettings() },
    {
      id: "userManagement",
      label: t("userManagement"),
      permission: () => canAccessUserManagement(),
    },
  ];

  const visibleTabs = tabs.filter((tab) => tab.permission());

  return (
    <div className="app" dir={isRTL ? "rtl" : "ltr"}>
      <Navigation
        currentScreen={currentScreen}
        onScreenChange={setCurrentScreen}
        tabs={visibleTabs}
        user={user}
        onLogout={handleLogout}
      />
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
}

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
