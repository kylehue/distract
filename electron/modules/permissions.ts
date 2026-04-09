import { ipcMain, systemPreferences } from "electron";

export async function setupPermissions() {
   ipcMain.handle("askCameraPermission", async (event) => {
      if (process.platform !== "darwin") return true;
      return await systemPreferences.askForMediaAccess("camera");
   });

   ipcMain.handle("askMicrophonePermission", async (event) => {
      if (process.platform !== "darwin") return true;
      return await systemPreferences.askForMediaAccess("microphone");
   });
}
