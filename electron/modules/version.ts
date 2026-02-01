import { ipcMain, app } from "electron";

export function setupVersion() {
   ipcMain.handle("get-version", () => app.getVersion());
}
