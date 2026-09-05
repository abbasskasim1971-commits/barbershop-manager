import {
  syncGetDeviceInfo,
  syncGetStatus,
  syncListStations,
  syncProvision,
  syncRegisterStation,
  syncRunNow,
} from "../infrastructure/database/databaseService";

export interface DeviceInfo {
  provisioned: boolean;
  role: string;
  stationId: number;
  stationUuid: string;
  label: string | null;
}

export interface SyncStatus {
  role: "owner" | "barber";
  provisioned: boolean;
  pending: number;
  sending: number;
  failed: number;
  sent: number;
  state: "online" | "offline" | "idle" | "syncing";
  syncing: boolean;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastError: string | null;
}

export interface StationEntry {
  id: number;
  stationUuid: string;
  role: string;
  label: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const SyncService = {
  getDeviceInfo(): Promise<DeviceInfo> {
    return syncGetDeviceInfo();
  },

  provision(host: string, port: number, token: string) {
    return syncProvision(host, port, token);
  },

  registerStation(sessionId: string, label: string) {
    return syncRegisterStation(sessionId, label);
  },

  getStatus(): Promise<SyncStatus> {
    return syncGetStatus();
  },

  runNow(): Promise<SyncStatus> {
    return syncRunNow();
  },

  listStations(sessionId: string): Promise<{ stations: StationEntry[] }> {
    return syncListStations(sessionId);
  },
};
