import * as fs from "fs";
import * as path from "path";
import { getDatabasePath } from "./paths";

const MAX_BACKUPS = 30;

export function getBackupDir(): string {
  const dir = path.join(path.dirname(getDatabasePath()), "backups");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function createBackup(stationId: number, businessDate: string): string | null {
  const dbPath = getDatabasePath();
  if (!fs.existsSync(dbPath)) return null;
  let backupPath: string | null = null;
  try {
    const backupsDir = getBackupDir();
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    backupPath = path.join(backupsDir, `eod-${stationId}-${businessDate}-${stamp}.db`);
    fs.copyFileSync(dbPath, backupPath);
    pruneOldBackups(backupsDir);
  } catch {
    return null;
  }
  return backupPath;
}

export function pruneOldBackups(backupsDir: string): void {
  try {
    const files = fs
      .readdirSync(backupsDir)
      .filter((f) => f.toLowerCase().endsWith(".db"))
      .map((f) => path.join(backupsDir, f))
      .filter((f) => fs.statSync(f).isFile())
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
    for (const file of files.slice(MAX_BACKUPS)) {
      fs.unlinkSync(file);
    }
  } catch {
    // Backup pruning is best-effort; ignore failures
  }
}
