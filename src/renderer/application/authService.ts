import {
  authLogin,
  authLoginPin,
  authLogout,
  authVerifySession,
  authChangePassword,
  authSetPin,
  authCreateUser,
  authDeactivateUser,
  authListUsers,
  authCheckOwnerExists,
  authFirstRunSetup,
} from "../infrastructure/database/databaseService";

export interface User {
  id: number;
  username: string;
  role: "owner" | "manager" | "barber";
}

interface AuthResult {
  success: boolean;
  error?: string;
  user?: User;
  sessionId?: string;
}

export interface ListUsersResult {
  users: { id: number; username: string; role: string; isActive: number; createdAt: string }[];
}

export class AuthService {
  private static sessionId: string | null = null;
  private static currentUser: User | null = null;

  static getSessionId(): string | null {
    return this.sessionId;
  }

  static getCurrentUser(): User | null {
    return this.currentUser;
  }

  static isAuthenticated(): boolean {
    return this.sessionId !== null && this.currentUser !== null;
  }

  static hasRole(role: "owner" | "manager" | "barber"): boolean {
    return this.currentUser?.role === role;
  }

  static isOwner(): boolean {
    return this.currentUser?.role === "owner";
  }

  static isManager(): boolean {
    return this.currentUser?.role === "manager";
  }

  static isBarber(): boolean {
    return this.currentUser?.role === "barber";
  }

  static canAccessReports(): boolean {
    return this.currentUser?.role === "owner";
  }

  static canAccessAnalytics(): boolean {
    return this.currentUser?.role === "owner";
  }

  static canAccessProfitLoss(): boolean {
    return this.currentUser?.role === "owner";
  }

  static canAccessInventory(): boolean {
    const role = this.currentUser?.role;
    return role === "owner" || role === "manager";
  }

  static canAccessPos(): boolean {
    const role = this.currentUser?.role;
    return role === "owner" || role === "manager";
  }

  static canAccessExpenses(): boolean {
    const role = this.currentUser?.role;
    return role === "owner" || role === "manager";
  }

  static canAccessServices(): boolean {
    const role = this.currentUser?.role;
    return role === "owner" || role === "manager";
  }

  static canAccessProducts(): boolean {
    const role = this.currentUser?.role;
    return role === "owner" || role === "manager";
  }

  static canAccessExpenseCategories(): boolean {
    const role = this.currentUser?.role;
    return role === "owner" || role === "manager";
  }

  static canAccessCommissionManagement(): boolean {
    return this.currentUser?.role === "owner";
  }

  static canAccessEodReport(): boolean {
    const role = this.currentUser?.role;
    return role === "owner" || role === "manager";
  }

  static canAccessUserManagement(): boolean {
    return this.currentUser?.role === "owner";
  }

  static canAccessSettings(): boolean {
    const role = this.currentUser?.role;
    return role === "owner" || role === "manager";
  }

  static async initializeSession(): Promise<boolean> {
    const storedSessionId = localStorage.getItem("sessionId");
    if (!storedSessionId) return false;

    const result = await authVerifySession(storedSessionId);
    if (result.valid && result.user) {
      this.sessionId = storedSessionId;
      this.currentUser = {
        id: result.user.id,
        username: result.user.username,
        role: result.user.role as "owner" | "manager" | "barber",
      };
      return true;
    }

    localStorage.removeItem("sessionId");
    return false;
  }

  static async login(username: string, password: string): Promise<AuthResult> {
    const result = await authLogin(username, password);
    if (result.success && result.sessionId && result.user) {
      this.sessionId = result.sessionId;
      this.currentUser = {
        id: result.user.id,
        username: result.user.username,
        role: result.user.role as "owner" | "manager" | "barber",
      };
      localStorage.setItem("sessionId", result.sessionId);
    }
    return {
      success: result.success,
      error: result.error,
      sessionId: result.sessionId,
      user: result.user
        ? {
            id: result.user.id,
            username: result.user.username,
            role: result.user.role as "owner" | "manager" | "barber",
          }
        : undefined,
    };
  }

  static async loginPin(pin: string): Promise<AuthResult> {
    const result = await authLoginPin(pin);
    if (result.success && result.sessionId && result.user) {
      this.sessionId = result.sessionId;
      this.currentUser = {
        id: result.user.id,
        username: result.user.username,
        role: result.user.role as "owner" | "manager" | "barber",
      };
      localStorage.setItem("sessionId", result.sessionId);
    }
    return {
      success: result.success,
      error: result.error,
      sessionId: result.sessionId,
      user: result.user
        ? {
            id: result.user.id,
            username: result.user.username,
            role: result.user.role as "owner" | "manager" | "barber",
          }
        : undefined,
    };
  }

  static async logout(): Promise<AuthResult> {
    const sessionId = this.sessionId;
    this.sessionId = null;
    this.currentUser = null;
    localStorage.removeItem("sessionId");
    if (sessionId) {
      return authLogout(sessionId);
    }
    return { success: true };
  }

  static async changePassword(oldPassword: string, newPassword: string): Promise<AuthResult> {
    const sessionId = this.sessionId;
    if (!sessionId) return { success: false, error: "No active session" };
    return authChangePassword(sessionId, oldPassword, newPassword);
  }

  static async setPin(pin: string): Promise<AuthResult> {
    const sessionId = this.sessionId;
    if (!sessionId) return { success: false, error: "No active session" };
    return authSetPin(sessionId, pin);
  }

  static async createUser(
    username: string,
    role: "owner" | "manager" | "barber",
    password?: string,
    pin?: string,
  ): Promise<AuthResult> {
    const sessionId = this.sessionId;
    if (!sessionId) return { success: false, error: "No active session" };
    return authCreateUser(sessionId, username, role, password, pin);
  }

  static async deactivateUser(userId: number): Promise<AuthResult> {
    const sessionId = this.sessionId;
    if (!sessionId) return { success: false, error: "No active session" };
    return authDeactivateUser(sessionId, userId);
  }

  static async listUsers(): Promise<ListUsersResult> {
    const sessionId = this.sessionId;
    if (!sessionId) return { users: [] };
    return authListUsers(sessionId);
  }

  static async checkOwnerExists(): Promise<{ exists: boolean }> {
    return authCheckOwnerExists();
  }

  static async firstRunSetup(username: string, password: string): Promise<AuthResult> {
    return authFirstRunSetup(username, password);
  }

  static clearSession(): void {
    this.sessionId = null;
    this.currentUser = null;
    localStorage.removeItem("sessionId");
  }
}
