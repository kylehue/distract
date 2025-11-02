import { app, BrowserWindow, ipcMain } from "electron";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { setupPythonBridge, stopPython } from "./python-bridge";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IS_DEV = process.env.NODE_ENV === "development";

process.env.APP_ROOT = path.join(__dirname, "..");

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
   ? path.join(process.env.APP_ROOT, "public")
   : RENDERER_DIST;

let win: BrowserWindow | null;

function createWindow() {
   win = new BrowserWindow({
      icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
      webPreferences: {
         preload: path.join(__dirname, "preload.mjs"),
         contextIsolation: true,
         nodeIntegration: false,
         devTools: IS_DEV,
      },
      autoHideMenuBar: true,
      width: 600,
      height: 400,
      title: "DISTRACT (Student Client)",
      darkTheme: true,
   });

   // win.removeMenu();

   if (IS_DEV) {
      win.webContents.openDevTools({ mode: "detach" });
   }

   // Test active push message to Renderer-process.
   win.webContents.on("did-finish-load", () => {
      win?.webContents.send(
         "main-process-message",
         new Date().toLocaleString()
      );
   });

   if (VITE_DEV_SERVER_URL) {
      // Dev mode → Vite dev server
      win.loadURL(VITE_DEV_SERVER_URL);
   } else {
      // Prod mode → load from app.asar/dist/index.html
      win.loadFile(path.join(__dirname, "../dist/index.html"));
   }

   return win;
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
   if (process.platform !== "darwin") {
      app.quit();
      win = null;
   }
});

app.on("activate", () => {
   // On OS X it's common to re-create a window in the app when the
   // dock icon is clicked and there are no other windows open.
   if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
   }
});

app.whenReady().then(() => {
   let win = createWindow();
   setupPythonBridge(win);
});

app.on("before-quit", () => {
   stopPython();
});
