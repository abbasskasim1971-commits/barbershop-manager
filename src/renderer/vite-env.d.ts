/// <reference types="vite/client" />

interface Api {
  openDatabase: (path: string) => Promise<void>;
  runMigration: (name: string, sql: string) => Promise<void>;
  insertRow: (table: string, row: Record<string, unknown>) => Promise<void>;
  getRow: (table: string, id: number) => Promise<unknown>;
  getAllRows: (table: string) => Promise<unknown[]>;
  query: (sql: string, params?: unknown[]) => Promise<unknown[]>;
}

declare global {
  interface Window {
    api: Api;
  }
}

export {};
