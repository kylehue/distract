import { ipcMain } from "electron";

export function setupApiKey() {
   ipcMain.handle("get-api-key", () => process.env.API_KEY || "");
}
