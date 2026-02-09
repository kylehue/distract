import { autoUpdater } from "electron-updater";

const IS_DEV = process.env.NODE_ENV === "development";
async function ensureLatestBeforeStart(splash: Electron.BrowserWindow) {
   if (IS_DEV) return; // electron-updater is disabled in dev

   return new Promise<void>((resolve) => {
      let done = false;
      const finish = () => {
         if (done) return;
         done = true;
         cleanup();
         resolve();
      };

      const cleanup = () => {
         autoUpdater.removeAllListeners("update-available");
         autoUpdater.removeAllListeners("update-not-available");
         autoUpdater.removeAllListeners("download-progress");
         autoUpdater.removeAllListeners("update-downloaded");
         autoUpdater.removeAllListeners("error");
      };

      autoUpdater.on("checking-for-update", () => {
         splash.webContents.send("splash:status", "Checking for updates...");
      });

      autoUpdater.on("update-available", () => {
         splash.webContents.send(
            "splash:status",
            "Update found. Downloading...",
         );
      });

      autoUpdater.on("download-progress", (p) => {
         const pct = Math.round(p.percent);
         splash.webContents.send(
            "splash:status",
            `Downloading update... ${pct}%`,
         );
      });

      autoUpdater.on("update-not-available", () => {
         splash.webContents.send("splash:status", "No updates. Starting...");
         finish();
      });

      autoUpdater.on("update-downloaded", () => {
         splash.webContents.send("splash:status", "Installing update...");
         // Install now (this quits the app)
         setImmediate(() => autoUpdater.quitAndInstall(false, true));
      });

      autoUpdater.on("error", (err) => {
         console.error("[updater] error", err);
         splash.webContents.send(
            "splash:status",
            "Update failed. Starting anyway...",
         );
         finish(); // fall back to starting app
      });

      autoUpdater.checkForUpdates();
   });
}

export async function setupAutoUpdater(splash: Electron.BrowserWindow) {
   await ensureLatestBeforeStart(splash);
}
