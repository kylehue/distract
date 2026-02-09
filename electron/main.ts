import { app, BrowserWindow } from "electron";
import { autoUpdater } from "electron-updater";
import { fileURLToPath } from "node:url";
import path from "node:path";
import dotenv from "dotenv";
import pkg from "../package.json" with { type: "json" };
import { setupPythonBridge } from "./modules/python-bridge";
import { setupUuid } from "./modules/uuid";
import { setupNotifications } from "./modules/notifications";
import { setupWindowLock } from "./modules/window-lock";
import { setupVersion } from "./modules/version";
import { setupApiKey } from "./modules/api-key";
import { setupTempFiles } from "./modules/temp-files";

const APP_NAME = "Distract (Student Client)";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IS_DEV = process.env.NODE_ENV === "development";

// setup env variables
dotenv.config({
   path: path.resolve(
      __dirname,
      "..",
      IS_DEV ? ".env.development" : ".env.production",
   ),
});

process.env.APP_ROOT = path.join(__dirname, "..");

export const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
   ? path.join(process.env.APP_ROOT, "public")
   : RENDERER_DIST;

// set app name
app.setName(APP_NAME);
if (process.platform === "win32") {
   app.setAppUserModelId(pkg.build.appId);
}

// ---------------------------
// Single instance lock
// ---------------------------
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
   // Another instance is already running -> exit this one
   app.quit();
} else {
   let win: BrowserWindow | null;
   let splash: BrowserWindow | null = null;

   // Handle second instance: focus the existing window
   app.on("second-instance", () => {
      if (win) {
         if (win.isMinimized()) win.restore();
         win.focus();
      }
   });

   function createSplash() {
      splash = new BrowserWindow({
         width: 300,
         height: 360,
         frame: false,
         resizable: false,
         movable: true,
         alwaysOnTop: true,
         center: true,
         show: false,
         autoHideMenuBar: true,
         backgroundColor: "#101014",
         webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            devTools: false,
         },
      });

      splash.removeMenu();

      splash.webContents.on("did-fail-load", (_e, code, desc, url) => {
         console.error("[splash] failed to load", { code, desc, url });
      });

      if (VITE_DEV_SERVER_URL) {
         splash.loadURL(`${VITE_DEV_SERVER_URL}/splash.html`);
      } else {
         splash.loadFile(path.join(__dirname, "../dist/splash.html"));
      }

      splash.show();

      splash.on("closed", () => {
         splash = null;
      });

      return splash;
   }

   function createWindow() {
      win = new BrowserWindow({
         icon: path.join(process.env.VITE_PUBLIC, "distract.ico"),
         show: false,
         webPreferences: {
            preload: path.join(__dirname, "preload.mjs"),
            contextIsolation: true,
            nodeIntegration: false,
            devTools: IS_DEV || true, // TODO: remove true
         },
         autoHideMenuBar: true,
         width: 600,
         height: 400,
         title: APP_NAME,
         darkTheme: true,
      });

      // TODO: uncomment
      // if (!IS_DEV) win.removeMenu();

      if (IS_DEV) {
         win.webContents.openDevTools({ mode: "detach" });
      }

      // Test active push message to Renderer-process.
      win.webContents.on("did-finish-load", () => {
         win?.webContents.send(
            "main-process-message",
            new Date().toLocaleString(),
         );
      });

      return win;
   }

   function loadWindow() {
      if (!win) return;

      win.webContents.once("did-finish-load", () => {
         win?.show();
         if (splash && !splash.isDestroyed()) {
            splash.close();
            splash = null;
         }
      });

      if (VITE_DEV_SERVER_URL) {
         win.loadURL(VITE_DEV_SERVER_URL);
      } else {
         win.loadFile(path.join(__dirname, "../dist/index.html"));
      }
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

   app.whenReady().then(async () => {
      createSplash();
      win = createWindow();
      await autoUpdater.checkForUpdatesAndNotify();

      // setup modules
      await setupPythonBridge(win);
      await setupUuid();
      await setupNotifications();
      await setupWindowLock(win);
      await setupApiKey();
      await setupVersion();
      await setupTempFiles();

      // load after module setup
      loadWindow();
   });
}
