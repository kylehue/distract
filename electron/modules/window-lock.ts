import { ipcMain, BrowserWindow, Menu } from "electron";

let isLocked = false;
let isKiosk = false;
let isFullScreen = false;
let isAlwaysOnTop = false;

let blurHandler: (() => void) | null = null;
let keyListener: ((event: any, input: any) => void) | null = null;

const SAFE_WORD = "hesoyam";
let safeWordIndex = 0;

function lockWindow(win: BrowserWindow): void {
   if (!win || isLocked) return;
   isLocked = true;

   // Fullscreen + kiosk mode + always on top
   isKiosk = win.isKiosk();
   isFullScreen = win.isFullScreen();
   isAlwaysOnTop = win.isAlwaysOnTop();
   win.setKiosk(true);
   win.setFullScreen(true);
   win.setAlwaysOnTop(true, "screen-saver");
   win.setMenu(null);

   // Force focus if user tries Alt-Tab
   blurHandler = () => {
      if (!win.isDestroyed()) win.focus();
   };
   win.on("blur", blurHandler);

   // Prevent closing while locked
   win.on("close", (e) => {
      if (isLocked) e.preventDefault();
   });

   // TODO: Remove safety? (dangerous)
   // Safety mechanism
   keyListener = (_, input) => {
      if (!input) return;
      if (!input.key) return;
      if (input.type !== "keyDown") return;
      let key = input.key.toLowerCase();
      if (key === SAFE_WORD[safeWordIndex].toLowerCase()) {
         safeWordIndex++;
      } else {
         safeWordIndex = 0;
      }

      if (safeWordIndex >= SAFE_WORD.length) {
         unlockWindow(win);
      }

      safeWordIndex %= SAFE_WORD.length;
   };
   win.webContents.on("before-input-event", keyListener);
}

function unlockWindow(win: BrowserWindow): void {
   if (!win || !isLocked) return;
   isLocked = false;

   // Remove blur/focus enforcement
   if (blurHandler) {
      win.removeListener("blur", blurHandler);
      blurHandler = null;
   }

   // Remove key listener
   if (keyListener) {
      win.webContents.removeListener("before-input-event", keyListener);
      keyListener = null;
   }

   // Revert
   win.setKiosk(isKiosk);
   win.setFullScreen(isFullScreen);
   win.setAlwaysOnTop(isAlwaysOnTop);
   Menu.setApplicationMenu(null); // Restore menu

   // Allow window to close again
   win.removeAllListeners("close");
}

export function setupWindowLock(win: BrowserWindow) {
   ipcMain.handle("lock-window", () => {
      lockWindow(win);
   });

   ipcMain.handle("unlock-window", () => {
      unlockWindow(win);
   });
}
