import { contextBridge, ipcRenderer } from 'electron';

interface DbApi {
  query: (sql: string, params?: unknown[]) => Promise<unknown[]>;
  getOne: (sql: string, params?: unknown[]) => Promise<unknown>;
  runSql: (sql: string, params?: unknown[]) => Promise<{ changes: number; lastInsertRowid: number }>;
  insert: (table: string, row: Record<string, unknown>) => Promise<{ changes: number; lastInsertRowid: number }>;
  update: (table: string, id: number, row: Record<string, unknown>) => Promise<{ changes: number }>;
  softDelete: (table: string, id: number) => Promise<{ changes: number }>;
  getDbPath: () => Promise<string>;
  getMigrations: () => Promise<{ name: string }[]>;
  addMigration: (name: string) => Promise<void>;
  logEvent: (eventType: string, details: string, stationId?: number) => Promise<void>;
  getEvents: (limit?: number, offset?: number) => Promise<unknown[]>;
}

interface AuthApi {
  login: (username: string, password: string, stationId: number) => Promise<{ success: boolean; error?: string; user?: { id: number; username: string; role: string }; sessionId?: string }>;
  loginPin: (pin: string, stationId: number) => Promise<{ success: boolean; error?: string; user?: { id: number; username: string; role: string }; sessionId?: string }>;
  logout: (sessionId: string) => Promise<{ success: boolean; error?: string }>;
  verifySession: (sessionId: string) => Promise<{ valid: boolean; user?: { id: number; username: string; role: string } }>;
  getCurrentUser: (sessionId: string) => Promise<{ user?: { id: number; username: string; role: string } }>;
  changePassword: (sessionId: string, oldPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  setPin: (sessionId: string, pin: string) => Promise<{ success: boolean; error?: string }>;
  createUser: (sessionId: string, username: string, role: 'owner' | 'manager' | 'barber', password?: string, pin?: string) => Promise<{ success: boolean; error?: string; userId?: number }>;
  deactivateUser: (sessionId: string, userId: number) => Promise<{ success: boolean; error?: string }>;
  listUsers: (sessionId: string) => Promise<{ users: { id: number; username: string; role: string; isActive: number; createdAt: string }[] }>;
  checkOwnerExists: () => Promise<{ exists: boolean }>;
  firstRunSetup: (username: string, password: string) => Promise<{ success: boolean; error?: string; userId?: number }>;
}

contextBridge.exposeInMainWorld('api', {
  query: (sql: string, params?: unknown[]) => ipcRenderer.invoke('query', sql, params),
  getOne: (sql: string, params?: unknown[]) => ipcRenderer.invoke('get-one', sql, params),
  runSql: (sql: string, params?: unknown[]) => ipcRenderer.invoke('run-sql', sql, params),
  insert: (table: string, row: Record<string, unknown>) => ipcRenderer.invoke('insert', table, row),
  update: (table: string, id: number, row: Record<string, unknown>) => ipcRenderer.invoke('update', table, id, row),
  softDelete: (table: string, id: number) => ipcRenderer.invoke('soft-delete', table, id),
  getDbPath: () => ipcRenderer.invoke('get-db-path'),
  getMigrations: () => ipcRenderer.invoke('get-migrations'),
  addMigration: (name: string) => ipcRenderer.invoke('add-migration', name),
  logEvent: (eventType: string, details: string, stationId?: number) => ipcRenderer.invoke('log-event', eventType, details, stationId),
  getEvents: (limit?: number, offset?: number) => ipcRenderer.invoke('get-events', limit, offset),
} as DbApi);

contextBridge.exposeInMainWorld('auth', {
  login: (username: string, password: string, stationId: number) => ipcRenderer.invoke('auth:login', username, password, stationId),
  loginPin: (pin: string, stationId: number) => ipcRenderer.invoke('auth:loginPin', pin, stationId),
  logout: (sessionId: string) => ipcRenderer.invoke('auth:logout', sessionId),
  verifySession: (sessionId: string) => ipcRenderer.invoke('auth:verifySession', sessionId),
  getCurrentUser: (sessionId: string) => ipcRenderer.invoke('auth:getCurrentUser', sessionId),
  changePassword: (sessionId: string, oldPassword: string, newPassword: string) => ipcRenderer.invoke('auth:changePassword', sessionId, oldPassword, newPassword),
  setPin: (sessionId: string, pin: string) => ipcRenderer.invoke('auth:setPin', sessionId, pin),
  createUser: (sessionId: string, username: string, role: 'owner' | 'manager' | 'barber', password?: string, pin?: string) => ipcRenderer.invoke('auth:createUser', sessionId, username, role, password, pin),
  deactivateUser: (sessionId: string, userId: number) => ipcRenderer.invoke('auth:deactivateUser', sessionId, userId),
  listUsers: (sessionId: string) => ipcRenderer.invoke('auth:listUsers', sessionId),
  checkOwnerExists: () => ipcRenderer.invoke('auth:checkOwnerExists'),
  firstRunSetup: (username: string, password: string) => ipcRenderer.invoke('auth:firstRunSetup', username, password),
} as AuthApi);

export type { DbApi, AuthApi };