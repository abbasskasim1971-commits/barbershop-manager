import { ipcMain } from "electron";
import bcrypt from "bcrypt";
import {
  UserRole,
  getUtcNow,
  runQuery,
  runOne,
  runSql,
  verifySession,
  requireAuth,
  logSystemEvent,
  beginTransaction,
  commitTransaction,
  rollbackTransaction,
  getDeviceStationId,
} from "../database";
import { getDatabasePath } from "../paths";
import type { BindParams, SqlValue } from "sql.js";

export function registerAuthHandlers(): void {
  ipcMain.handle("get-db-path", async (_event, sessionId: string) => {
    const session = requireAuth(sessionId, ["owner", "manager"]);
    if (!session) return null;
    return getDatabasePath();
  });

  ipcMain.handle("auth:login", async (_event, username: string, password: string) => {
    try {
      const user = runOne("SELECT * FROM users WHERE username = ? AND is_active = 1", [
        username,
      ] as BindParams);
      if (!user) {
        logSystemEvent(
          "login_failed",
          `Failed login attempt for username: ${username}`,
          getDeviceStationId(),
        );
        return { success: false, error: "Invalid credentials" };
      }

      const passwordHash = user[3] as string | null;
      if (!passwordHash) {
        logSystemEvent(
          "login_failed",
          `No password set for user: ${username}`,
          getDeviceStationId(),
        );
        return { success: false, error: "No password set for this account" };
      }

      const isValid = bcrypt.compareSync(password, passwordHash);
      if (!isValid) {
        logSystemEvent(
          "login_failed",
          `Invalid password for user: ${username}`,
          getDeviceStationId(),
        );
        return { success: false, error: "Invalid credentials" };
      }

      const userId = user[0] as number;
      const role = user[2] as UserRole;
      const sessionId = `session_${crypto.randomUUID()}`;
      const stationId = getDeviceStationId();

      runSql(
        "INSERT INTO user_sessions (session_id, user_id, station_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?)",
        [
          sessionId,
          userId,
          stationId,
          getUtcNow(),
          new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        ] as BindParams,
      );

      logSystemEvent("login_success", `User ${username} logged in`, stationId);

      return {
        success: true,
        user: { id: userId, username: user[1] as string, role },
        sessionId,
      };
    } catch (error) {
      return { success: false, error: "Authentication failed" };
    }
  });

  ipcMain.handle("auth:loginPin", async (_event, pin: string) => {
    try {
      const users = runQuery("SELECT * FROM users WHERE role = ? AND is_active = 1", [
        "barber",
      ] as BindParams);
      let matchedUser: SqlValue[] | null = null;

      for (const user of users) {
        const pinHash = user[4] as string | null;
        if (pinHash && bcrypt.compareSync(pin, pinHash)) {
          matchedUser = user;
          break;
        }
      }

      if (!matchedUser) {
        logSystemEvent("login_failed", "Invalid PIN attempt", getDeviceStationId());
        return { success: false, error: "Invalid PIN" };
      }

      const userId = matchedUser[0] as number;
      const sessionId = `session_${crypto.randomUUID()}`;
      const stationId = getDeviceStationId();

      runSql(
        "INSERT INTO user_sessions (session_id, user_id, station_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?)",
        [
          sessionId,
          userId,
          stationId,
          getUtcNow(),
          new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        ] as BindParams,
      );

      logSystemEvent("login_success", `Barber ${matchedUser[1]} logged in via PIN`, stationId);

      return {
        success: true,
        user: { id: userId, username: matchedUser[1] as string, role: "barber" as const },
        sessionId,
      };
    } catch (error) {
      return { success: false, error: "Authentication failed" };
    }
  });

  ipcMain.handle("auth:logout", async (_event, sessionId: string) => {
    try {
      if (!sessionId) return { success: true };
      const session = verifySession(sessionId);
      if (!session) return { success: true };
      runSql("DELETE FROM user_sessions WHERE session_id = ?", [sessionId] as BindParams);
      logSystemEvent("logout", `Session logged out`, session.stationId);
      return { success: true };
    } catch (error) {
      return { success: false, error: "Logout failed" };
    }
  });

  ipcMain.handle("auth:verifySession", async (_event, sessionId: string) => {
    try {
      if (!sessionId) return { valid: false };
      const session = runOne(
        "SELECT * FROM user_sessions WHERE session_id = ? AND expires_at > ?",
        [sessionId, getUtcNow()] as BindParams,
      );
      if (!session) return { valid: false };
      const user = runOne("SELECT id, username, role FROM users WHERE id = ? AND is_active = 1", [
        session[1],
      ] as BindParams);
      if (!user) return { valid: false };
      return {
        valid: true,
        user: { id: user[0] as number, username: user[1] as string, role: user[2] as UserRole },
      };
    } catch (error) {
      return { valid: false };
    }
  });

  ipcMain.handle("auth:getCurrentUser", async (_event, sessionId: string) => {
    try {
      if (!sessionId) return { user: null };
      const session = runOne(
        "SELECT * FROM user_sessions WHERE session_id = ? AND expires_at > ?",
        [sessionId, getUtcNow()] as BindParams,
      );
      if (!session) return { user: null };
      const user = runOne("SELECT id, username, role FROM users WHERE id = ? AND is_active = 1", [
        session[1],
      ] as BindParams);
      if (!user) return { user: null };
      return {
        user: { id: user[0] as number, username: user[1] as string, role: user[2] as UserRole },
      };
    } catch (error) {
      return { user: null };
    }
  });

  ipcMain.handle(
    "auth:changePassword",
    async (_event, sessionId: string, oldPassword: string, newPassword: string) => {
      try {
        const session = verifySession(sessionId);
        if (!session) return { success: false, error: "Invalid session" };

        const userId = session.userId;
        const user = runOne("SELECT * FROM users WHERE id = ?", [userId] as BindParams);
        if (!user) return { success: false, error: "User not found" };

        const passwordHash = user[3] as string | null;
        if (!passwordHash || !bcrypt.compareSync(oldPassword, passwordHash)) {
          return { success: false, error: "Current password is incorrect" };
        }

        const newPasswordHash = bcrypt.hashSync(newPassword, 10);
        beginTransaction();
        try {
          runSql("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?", [
            newPasswordHash,
            getUtcNow(),
            userId,
          ] as BindParams);
          runSql("DELETE FROM user_sessions WHERE user_id = ?", [userId] as BindParams);
          commitTransaction();
        } catch (txError) {
          rollbackTransaction();
          throw txError;
        }

        logSystemEvent(
          "password_changed",
          `Password changed for user ${user[1]}`,
          session.stationId,
        );

        return { success: true };
      } catch (error) {
        return { success: false, error: "Failed to change password" };
      }
    },
  );

  ipcMain.handle("auth:setPin", async (_event, sessionId: string, pin: string) => {
    try {
      const session = verifySession(sessionId);
      if (!session) return { success: false, error: "Invalid session" };

      const userId = session.userId;
      const pinHash = bcrypt.hashSync(pin, 10);
      const existingPin = runOne(
        "SELECT id FROM users WHERE role = ? AND pin_hash = ? AND is_active = 1 AND id != ?",
        ["barber", pinHash, userId] as BindParams,
      );
      if (existingPin) {
        return { success: false, error: "PIN already in use by another active barber" };
      }
      runSql("UPDATE users SET pin_hash = ?, updated_at = ? WHERE id = ?", [
        pinHash,
        getUtcNow(),
        userId,
      ] as BindParams);

      return { success: true };
    } catch (error) {
      return { success: false, error: "Failed to set PIN" };
    }
  });

  ipcMain.handle(
    "auth:createUser",
    async (
      _event,
      sessionId: string,
      username: string,
      role: UserRole,
      password?: string,
      pin?: string,
    ) => {
      try {
        const session = requireAuth(sessionId, ["owner"]);
        if (!session) return { success: false, error: "Only owner can create users" };

        if (role === "owner") {
          return { success: false, error: "Cannot create another owner" };
        }

        const now = getUtcNow();
        const passwordHash = password ? bcrypt.hashSync(password, 10) : null;
        const pinHash = pin ? bcrypt.hashSync(pin, 10) : null;
        if (role === "barber" && pinHash) {
          const existingPin = runOne(
            "SELECT id FROM users WHERE role = ? AND pin_hash = ? AND is_active = 1",
            ["barber", pinHash] as BindParams,
          );
          if (existingPin) {
            return { success: false, error: "PIN already in use by another active barber" };
          }
        }

        const result = runSql(
          "INSERT INTO users (username, role, password_hash, pin_hash, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [username, role, passwordHash, pinHash, 1, now, now] as BindParams,
        );

        logSystemEvent(
          "user_created",
          `User ${username} created with role ${role}`,
          session.stationId,
        );

        return { success: true, userId: result.lastInsertRowid };
      } catch (error) {
        return { success: false, error: "Failed to create user" };
      }
    },
  );

  ipcMain.handle("auth:deactivateUser", async (_event, sessionId: string, userId: number) => {
    try {
      const session = requireAuth(sessionId, ["owner"]);
      if (!session) return { success: false, error: "Only owner can deactivate users" };

      if (userId === session.userId) {
        return { success: false, error: "Cannot deactivate yourself" };
      }

      const targetUser = runOne("SELECT role FROM users WHERE id = ?", [userId] as BindParams);
      if (!targetUser) return { success: false, error: "User not found" };
      if (targetUser[0] === "owner") return { success: false, error: "Cannot deactivate owner" };

      beginTransaction();
      try {
        runSql("UPDATE users SET is_active = 0, updated_at = ? WHERE id = ?", [
          getUtcNow(),
          userId,
        ] as BindParams);
        runSql("DELETE FROM user_sessions WHERE user_id = ?", [userId] as BindParams);
        commitTransaction();
      } catch (txError) {
        rollbackTransaction();
        throw txError;
      }

      logSystemEvent("user_deactivated", `User id ${userId} deactivated`, session.stationId);

      return { success: true };
    } catch (error) {
      return { success: false, error: "Failed to deactivate user" };
    }
  });

  ipcMain.handle("auth:listUsers", async (_event, sessionId: string) => {
    try {
      const session = requireAuth(sessionId, ["owner"]);
      if (!session) return { users: [] };

      const users = runQuery(
        "SELECT id, username, role, is_active, created_at FROM users ORDER BY id",
      );
      return {
        users: users.map((u) => ({
          id: u[0] as number,
          username: u[1] as string,
          role: u[2] as string,
          isActive: u[3] as number,
          createdAt: u[4] as string,
        })),
      };
    } catch (error) {
      return { users: [] };
    }
  });

  ipcMain.handle("auth:checkOwnerExists", async () => {
    try {
      const existing = runOne("SELECT id FROM users WHERE role = 'owner' AND is_active = 1");
      return { exists: !!existing };
    } catch (error) {
      return { exists: false };
    }
  });

  ipcMain.handle("auth:firstRunSetup", async (_event, username: string, password: string) => {
    try {
      const existing = runOne("SELECT id FROM users WHERE role = 'owner' AND is_active = 1");
      if (existing) {
        return { success: false, error: "Owner already exists" };
      }

      if (!username || !password) {
        return { success: false, error: "Username and password are required" };
      }

      if (password.length < 8) {
        return { success: false, error: "Password must be at least 8 characters" };
      }

      const passwordHash = bcrypt.hashSync(password, 10);
      const now = getUtcNow();

      const result = runSql(
        "INSERT INTO users (username, role, password_hash, pin_hash, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [username, "owner", passwordHash, null, 1, now, now] as BindParams,
      );

      logSystemEvent(
        "first_run_setup",
        `First Owner account created: ${username}`,
        getDeviceStationId(),
      );

      return { success: true, userId: result.lastInsertRowid };
    } catch (error) {
      return { success: false, error: "Failed to create Owner account" };
    }
  });
}
