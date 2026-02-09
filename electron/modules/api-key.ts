import { ipcMain } from "electron";

export async function setupApiKey() {
   ipcMain.handle("get-api-key", () => process.env.API_KEY || "");
}
