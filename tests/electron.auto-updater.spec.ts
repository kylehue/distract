// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const updaterHandlers = new Map<string, Array<(...args: any[]) => void>>();

const autoUpdater = {
   on: vi.fn((event: string, handler: (...args: any[]) => void) => {
      const list = updaterHandlers.get(event) ?? [];
      list.push(handler);
      updaterHandlers.set(event, list);
   }),
   removeAllListeners: vi.fn((event: string) => {
      updaterHandlers.delete(event);
   }),
   checkForUpdates: vi.fn(),
   quitAndInstall: vi.fn(),
};

vi.mock("electron-updater", () => ({
   autoUpdater,
}));

function emit(event: string, payload?: any) {
   for (const cb of updaterHandlers.get(event) ?? []) cb(payload);
}

describe("setupAutoUpdater", () => {
   const splash = {
      webContents: {
         send: vi.fn(),
      },
   };
   let oldNodeEnv = process.env.NODE_ENV;

   beforeEach(() => {
      vi.resetModules();
      updaterHandlers.clear();
      autoUpdater.on.mockClear();
      autoUpdater.removeAllListeners.mockClear();
      autoUpdater.checkForUpdates.mockClear();
      autoUpdater.quitAndInstall.mockClear();
      splash.webContents.send.mockClear();
      oldNodeEnv = process.env.NODE_ENV;
   });

   afterEach(() => {
      process.env.NODE_ENV = oldNodeEnv;
   });

   it("skips updater checks in development mode", async () => {
      process.env.NODE_ENV = "development";
      const { setupAutoUpdater } =
         await import("../electron/modules/auto-updater");
      await setupAutoUpdater(splash as any);

      expect(autoUpdater.checkForUpdates).not.toHaveBeenCalled();
      expect(autoUpdater.on).not.toHaveBeenCalled();
   });

   it("reports progress and resolves when no updates are available", async () => {
      process.env.NODE_ENV = "production";
      const { setupAutoUpdater } =
         await import("../electron/modules/auto-updater");

      const pending = setupAutoUpdater(splash as any);
      expect(autoUpdater.checkForUpdates).toHaveBeenCalled();

      emit("checking-for-update");
      emit("update-available");
      emit("download-progress", { percent: 48.8 });
      emit("update-not-available");
      await pending;

      expect(splash.webContents.send).toHaveBeenCalledWith(
         "splash:status",
         "Checking for updates...",
      );
      expect(splash.webContents.send).toHaveBeenCalledWith(
         "splash:status",
         "Update found. Downloading...",
      );
      expect(splash.webContents.send).toHaveBeenCalledWith(
         "splash:status",
         "Downloading update... 49%",
      );
      expect(splash.webContents.send).toHaveBeenCalledWith(
         "splash:status",
         "No updates. Starting...",
      );
      expect(autoUpdater.removeAllListeners).toHaveBeenCalled();
   });

   it("falls back gracefully when updater errors", async () => {
      process.env.NODE_ENV = "production";
      const { setupAutoUpdater } =
         await import("../electron/modules/auto-updater");

      const pending = setupAutoUpdater(splash as any);
      emit("error", new Error("network down"));
      await pending;

      expect(splash.webContents.send).toHaveBeenCalledWith(
         "splash:status",
         "Update failed. Starting anyway...",
      );
   });
});
