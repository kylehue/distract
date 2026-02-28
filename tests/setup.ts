import { afterEach, vi } from "vitest";

declare global {
   interface Window {
      // @ts-ignore
      api: Record<string, any>;
   }
}

if (typeof window !== "undefined") {
   if (!window.api) {
      // @ts-ignore
      window.api = {};
   }

   // Safe defaults for modules that import at top-level during tests.
   if (!window.api.getUuid) {
      window.api.getUuid = vi.fn().mockResolvedValue("test-uuid");
   }
   if (!window.api.getApiKey) {
      window.api.getApiKey = vi.fn().mockResolvedValue("test-api-key");
   }
   if (!window.api.getVersion) {
      window.api.getVersion = vi.fn().mockResolvedValue("0.0.0-test");
   }
   if (!window.api.getTempMonitorLogs) {
      window.api.getTempMonitorLogs = vi.fn().mockResolvedValue([]);
   }
   if (!window.api.writeTempMonitorLog) {
      window.api.writeTempMonitorLog = vi.fn().mockResolvedValue("queued.json");
   }
   if (!window.api.deleteTempMonitorLog) {
      window.api.deleteTempMonitorLog = vi.fn().mockResolvedValue(undefined);
   }
   if (!window.api.readTempVideo) {
      window.api.readTempVideo = vi
         .fn()
         .mockResolvedValue({ buffer: Buffer.from([]), mimetype: "video/webm" });
   }
   if (!window.api.cleanupTempVideo) {
      window.api.cleanupTempVideo = vi.fn().mockResolvedValue(undefined);
   }
}

afterEach(() => {
   vi.clearAllMocks();
});
