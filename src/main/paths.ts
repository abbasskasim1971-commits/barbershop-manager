import { app } from 'electron';
import path from 'path';

const getUserDataPath = (): string => {
  return app.getPath('userData');
};

const getDatabasePath = (): string => {
  return path.join(getUserDataPath(), 'barbershop.db');
};

const getBackupPath = (customPath?: string): string => {
  if (customPath) {
    return customPath;
  }
  return path.join(getUserDataPath(), 'backups');
};

export { getUserDataPath, getDatabasePath, getBackupPath };