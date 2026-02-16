// @vitest-environment node
import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ipcHandlers = new Map<string, (...args: any[]) => any>();
const appEvents = new Map<string, (...args: any[]) => any>();

const ipcMain = {
   handle: vi.fn((channel: string, handler: (...args: any[]) => any) => {
      ipcHandlers.set(channel, handler);
   }),
};
const dialog = {
   showMessageBox: vi.fn(),
};
const app = {
   on: vi.fn((event: string, handler: (...args: any[]) => any) => {
      appEvents.set(event, handler);
   }),
};
const Menu = {
   setApplicationMenu: vi.fn(),
};

vi.mock("electron", () => ({
   ipcMain,
   dialog,
   app,
   Menu,
   BrowserWindow: class {},
}));

class FakeWebContents extends EventEmitter {
   send = vi.fn();
}

class FakeWindow extends EventEmitter {
   webContents = new FakeWebContents();
   close = vi.fn();
   focus = vi.fn();
   setKiosk = vi.fn();
   setFullScreen = vi.fn();
   setAlwaysOnTop = vi.fn();
   setMenu = vi.fn();
   removeListener = vi.fn((event: string, listener: (...args: any[]) => void) => {
      return super.removeListener(event, listener);
   });
   removeAllListeners = vi.fn((event?: string) => {
      return super.removeAllListeners(event as any);
   });
   isDestroyed = vi.fn(() => false);
   isKiosk = vi.fn(() => false);
   isFullScreen = vi.fn(() => false);
   isAlwaysOnTop = vi.fn(() => false);
}

describe("window lock + close dialog modules", () => {
   beforeEach(() => {
      vi.resetModules();
      ipcHandlers.clear();
      appEvents.clear();
      ipcMain.handle.mockClear();
      dialog.showMessageBox.mockReset();
      app.on.mockClear();
      Menu.setApplicationMenu.mockClear();
   });

   it("locks window, prevents close, and unlocks via safe word sequence", async () => {
      const win = new FakeWindow();
      const { setupWindowLock } = await import("../electron/modules/window-lock");
      await setupWindowLock(win as any);

      ipcHandlers.get("lock-window")!();

      expect(win.setKiosk).toHaveBeenCalledWith(true);
      expect(win.setFullScreen).toHaveBeenCalledWith(true);
      expect(win.setAlwaysOnTop).toHaveBeenCalledWith(true, "screen-saver");
      expect(win.setMenu).toHaveBeenCalledWith(null);

      win.emit("blur");
      expect(win.focus).toHaveBeenCalled();

      const preventDefault = vi.fn();
      win.emit("close", { preventDefault });
      expect(preventDefault).toHaveBeenCalled();

      for (const key of "hesoyam") {
         win.webContents.emit("before-input-event", {}, { type: "keyDown", key });
      }

      expect(win.setKiosk).toHaveBeenLastCalledWith(false);
      expect(win.setFullScreen).toHaveBeenLastCalledWith(false);
      expect(win.setAlwaysOnTop).toHaveBeenLastCalledWith(false);
      expect(Menu.setApplicationMenu).toHaveBeenCalledWith(null);
   });

   it("shows guarded close dialog and updates close-warning flag via IPC", async () => {
      const win = new FakeWindow();
      const { setupCloseDialog } = await import("../electron/modules/close-dialog");
      await setupCloseDialog(win as any);

      expect(ipcHandlers.get("get-show-close-warning-dialog")!()).toBe(false);
      expect(
         ipcHandlers.get("set-show-close-warning-dialog")!(null, true),
      ).toBe(true);

      dialog.showMessageBox.mockResolvedValueOnce({ response: 0 });
      const closeEvent1 = { preventDefault: vi.fn() };
      win.emit("close", closeEvent1);
      await Promise.resolve();
      expect(closeEvent1.preventDefault).toHaveBeenCalled();
      expect(win.close).not.toHaveBeenCalled();

      dialog.showMessageBox.mockResolvedValueOnce({ response: 1 });
      const closeEvent2 = { preventDefault: vi.fn() };
      win.emit("close", closeEvent2);
      await Promise.resolve();
      expect(closeEvent2.preventDefault).toHaveBeenCalled();
      expect(win.close).toHaveBeenCalled();

      appEvents.get("before-quit")?.();
      const closeEvent3 = { preventDefault: vi.fn() };
      win.emit("close", closeEvent3);
      expect(closeEvent3.preventDefault).not.toHaveBeenCalled();
   });
});
