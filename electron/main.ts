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
import { setupAutoUpdater } from "./modules/auto-updater";

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
   let mainWindow: BrowserWindow | null;
   let splashWindow: BrowserWindow | null = null;

   // Handle second instance: focus the existing window
   app.on("second-instance", () => {
      if (mainWindow) {
         if (mainWindow.isMinimized()) mainWindow.restore();
         mainWindow.focus();
      }
   });

   function createSplashWindow() {
      splashWindow = new BrowserWindow({
         width: 300,
         height: 350,
         frame: false,
         resizable: false,
         movable: true,
         alwaysOnTop: false,
         center: true,
         show: false,
         autoHideMenuBar: true,
         backgroundColor: "#101014",
         webPreferences: {
            preload: path.join(__dirname, "preload.mjs"),
            contextIsolation: true,
            nodeIntegration: false,
            devTools: false,
         },
      });

      splashWindow.removeMenu();

      splashWindow.webContents.on("did-fail-load", (_e, code, desc, url) => {
         console.error("[splash] failed to load", { code, desc, url });
      });

      if (VITE_DEV_SERVER_URL) {
         splashWindow.loadURL(`${VITE_DEV_SERVER_URL}/splash.html`);
      } else {
         splashWindow.loadFile(path.join(__dirname, "../dist/splash.html"));
      }

      splashWindow.show();

      splashWindow.on("closed", () => {
         splashWindow = null;
      });

      return splashWindow;
   }

   function createMainWindow() {
      mainWindow = new BrowserWindow({
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
      // if (!IS_DEV) mainWindow.removeMenu();

      if (IS_DEV) {
         mainWindow.webContents.openDevTools({ mode: "detach" });
      }

      // Test active push message to Renderer-process.
      mainWindow.webContents.on("did-finish-load", () => {
         mainWindow?.webContents.send(
            "main-process-message",
            new Date().toLocaleString(),
         );
      });

      return mainWindow;
   }

   function loadWindow() {
      if (!mainWindow) return;

      mainWindow.webContents.once("did-finish-load", () => {
         mainWindow?.show();
         if (splashWindow && !splashWindow.isDestroyed()) {
            splashWindow.close();
            splashWindow = null;
         }
      });

      if (VITE_DEV_SERVER_URL) {
         mainWindow.loadURL(VITE_DEV_SERVER_URL);
      } else {
         mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
      }
   }

   // ---------------------------
   // App lifecycle
   // ---------------------------
   app.on("window-all-closed", () => {
      if (process.platform !== "darwin") {
         app.quit();
         mainWindow = null;
      }
   });

   app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
         createMainWindow();
      }
   });

   app.whenReady().then(async () => {
      splashWindow = createSplashWindow();
      await setupAutoUpdater(splashWindow);
      mainWindow = createMainWindow();

      // setup modules
      splashWindow?.webContents.send("splash:status", "Robots are warming up...");
      await setupPythonBridge(mainWindow);
      splashWindow?.webContents.send("splash:status", "Wiring modules...");
      await setupUuid();
      await setupNotifications();
      await setupWindowLock(mainWindow);
      await setupApiKey();
      await setupVersion();
      await setupTempFiles();
      splashWindow?.webContents.send("splash:status", "Starting app...");

      // load after module setup
      loadWindow();
   });
}
