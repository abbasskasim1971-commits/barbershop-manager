import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { AuthService, User } from "../../application/authService";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (
    username: string,
    password: string,
    stationId?: number,
  ) => Promise<{ success: boolean; error?: string }>;
  loginPin: (pin: string, stationId?: number) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  changePassword: (
    oldPassword: string,
    newPassword: string,
  ) => Promise<{ success: boolean; error?: string }>;
  setPin: (pin: string) => Promise<{ success: boolean; error?: string }>;
  createUser: (
    username: string,
    role: "owner" | "manager" | "barber",
    password?: string,
    pin?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  deactivateUser: (userId: number) => Promise<{ success: boolean; error?: string }>;
  listUsers: () => Promise<{
    users: { id: number; username: string; role: string; isActive: number; createdAt: string }[];
  }>;
  checkOwnerExists: () => Promise<{ exists: boolean }>;
  firstRunSetup: (
    username: string,
    password: string,
  ) => Promise<{ success: boolean; error?: string }>;
  isAuthenticated: () => boolean;
  getSessionId: () => string | null;
  hasRole: (role: "owner" | "manager" | "barber") => boolean;
  isOwner: () => boolean;
  isManager: () => boolean;
  isBarber: () => boolean;
  canAccessReports: () => boolean;
  canAccessAnalytics: () => boolean;
  canAccessProfitLoss: () => boolean;
  canAccessInventory: () => boolean;
  canAccessPos: () => boolean;
  canAccessExpenses: () => boolean;
  canAccessServices: () => boolean;
  canAccessProducts: () => boolean;
  canAccessExpenseCategories: () => boolean;
  canAccessCommissionManagement: () => boolean;
  canAccessUserManagement: () => boolean;
  canAccessSettings: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const initialized = await AuthService.initializeSession();
      if (initialized) {
        setUser(AuthService.getCurrentUser());
      }
      setIsLoading(false);
    };
    initAuth();
  }, []);

  const login = async (username: string, password: string, stationId = 1) => {
    const result = await AuthService.login(username, password, stationId);
    if (result.success) {
      setUser(AuthService.getCurrentUser());
    }
    return { success: result.success, error: result.error };
  };

  const loginPin = async (pin: string, stationId = 1) => {
    const result = await AuthService.loginPin(pin, stationId);
    if (result.success) {
      setUser(AuthService.getCurrentUser());
    }
    return { success: result.success, error: result.error };
  };

  const logout = async () => {
    await AuthService.logout();
    setUser(null);
  };

  const changePassword = async (oldPassword: string, newPassword: string) => {
    return AuthService.changePassword(oldPassword, newPassword);
  };

  const setPin = async (pin: string) => {
    return AuthService.setPin(pin);
  };

  const createUser = async (
    username: string,
    role: "owner" | "manager" | "barber",
    password?: string,
    pin?: string,
  ) => {
    return AuthService.createUser(username, role, password, pin);
  };

  const deactivateUser = async (userId: number) => {
    return AuthService.deactivateUser(userId);
  };

  const listUsers = async () => {
    return AuthService.listUsers();
  };

  const checkOwnerExists = async () => {
    return AuthService.checkOwnerExists();
  };

  const firstRunSetup = async (username: string, password: string) => {
    return AuthService.firstRunSetup(username, password);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        loginPin,
        logout,
        changePassword,
        setPin,
        createUser,
        deactivateUser,
        listUsers,
        checkOwnerExists,
        firstRunSetup,
        isAuthenticated: () => AuthService.isAuthenticated(),
        getSessionId: () => AuthService.getSessionId(),
        hasRole: (role: "owner" | "manager" | "barber") => AuthService.hasRole(role),
        isOwner: () => AuthService.isOwner(),
        isManager: () => AuthService.isManager(),
        isBarber: () => AuthService.isBarber(),
        canAccessReports: () => AuthService.canAccessReports(),
        canAccessAnalytics: () => AuthService.canAccessAnalytics(),
        canAccessProfitLoss: () => AuthService.canAccessProfitLoss(),
        canAccessInventory: () => AuthService.canAccessInventory(),
        canAccessPos: () => AuthService.canAccessPos(),
        canAccessExpenses: () => AuthService.canAccessExpenses(),
        canAccessServices: () => AuthService.canAccessServices(),
        canAccessProducts: () => AuthService.canAccessProducts(),
        canAccessExpenseCategories: () => AuthService.canAccessExpenseCategories(),
        canAccessCommissionManagement: () => AuthService.canAccessCommissionManagement(),
        canAccessUserManagement: () => AuthService.canAccessUserManagement(),
        canAccessSettings: () => AuthService.canAccessSettings(),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
