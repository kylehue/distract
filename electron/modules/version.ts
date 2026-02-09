import { ipcMain, app } from "electron";

export async function setupVersion() {
   ipcMain.handle("get-version", () => app.getVersion());
}
