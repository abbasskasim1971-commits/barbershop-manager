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

export type { DbApi };