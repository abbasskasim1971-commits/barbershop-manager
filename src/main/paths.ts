import { app } from "electron";
import path from "path";

const getUserDataPath = (): string => {
  return app.getPath("userData");
};

const getDatabasePath = (): string => {
  return path.join(getUserDataPath(), "barbershop.db");
};

export { getUserDataPath, getDatabasePath };
