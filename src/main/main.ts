import { app, BrowserWindow } from "electron";
import path from "path";
import { initializeDatabase, saveDatabase, isBarberProvisioned } from "./database";
import { startIngestServer, stopIngestServer } from "./ingest";
import { startSyncClient, stopSyncClient } from "./sync/client";
import { registerAuthHandlers } from "./ipc/auth";
import { registerServiceHandlers } from "./ipc/services";
import { registerProductHandlers } from "./ipc/products";
import { registerExpenseHandlers } from "./ipc/expenses";
import { registerSalesHandlers } from "./ipc/sales";
import { registerAuditHandlers } from "./ipc/audit";
import { registerEodHandlers } from "./ipc/eod";
import { registerReportHandlers } from "./ipc/reports";
import { registerSyncHandlers } from "./ipc/sync";

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: "Barbershop Management",
  });

  if (process.env.NODE_ENV === "development") {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(path.join(__dirname, "../../dist/renderer/index.html"));
  }
}

function setupIPC(): void {
  registerAuthHandlers();
  registerServiceHandlers();
  registerProductHandlers();
  registerExpenseHandlers();
  registerSalesHandlers();
  registerAuditHandlers();
  registerEodHandlers();
  registerReportHandlers();
  registerSyncHandlers();
}

app.whenReady().then(async () => {
  await initializeDatabase();
  setupIPC();
  if (isBarberProvisioned()) {
    startSyncClient();
  } else {
    startIngestServer();
  }
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on("before-quit", () => {
  stopIngestServer();
  stopSyncClient();
  saveDatabase();
});
