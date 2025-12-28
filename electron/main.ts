import { app, BrowserWindow, ipcMain } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { setupPythonBridge, stopPython } from "./python-bridge";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IS_DEV = process.env.NODE_ENV === "development";

process.env.APP_ROOT = path.join(__dirname, "..");

export const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
   ? path.join(process.env.APP_ROOT, "public")
   : RENDERER_DIST;

let win: BrowserWindow | null;

// ---------------------------
// Single instance lock
// ---------------------------
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
   // Another instance is already running -> exit this one
   app.quit();
} else {
   // Handle second instance: focus the existing window
   app.on("second-instance", () => {
      if (win) {
         if (win.isMinimized()) win.restore();
         win.focus();
      }
   });

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
         title: "Distract (Student Client)",
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
         win.loadURL(VITE_DEV_SERVER_URL);
      } else {
         win.loadFile(path.join(__dirname, "../dist/index.html"));
      }

      return win;
   }

   // ---------------------------
   // App lifecycle
   // ---------------------------
   app.on("window-all-closed", () => {
      if (process.platform !== "darwin") {
         app.quit();
         win = null;
      }
   });

   app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
         createWindow();
      }
   });

   app.whenReady().then(() => {
      win = createWindow();
      setupPythonBridge(win);
   });

   app.on("before-quit", () => {
      stopPython();
   });
}
