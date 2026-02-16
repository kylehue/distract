// @vitest-environment node
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const handlers = new Map<string, (...args: any[]) => any>();
const ipcMain = {
   handle: vi.fn((channel: string, handler: (...args: any[]) => any) => {
      handlers.set(channel, handler);
   }),
};
const app = {
   getPath: vi.fn((name: string) => {
      if (name === "userData") return path.join("C:", "UserData");
      if (name === "temp") return path.join("C:", "Temp");
      return "";
   }),
};

const fsMock = {
   readFile: vi.fn(),
   writeFile: vi.fn(),
   rm: vi.fn(),
   mkdir: vi.fn(),
   unlink: vi.fn(),
   readdir: vi.fn(),
};

const mime = {
   extension: vi.fn((type: string) => (type === "video/webm" ? "webm" : false)),
   lookup: vi.fn((_ext: string) => "video/webm"),
};

const randomUUID = vi.fn(() => "uuid-generated");

vi.mock("electron", () => ({
   ipcMain,
   app,
}));

vi.mock("node:fs/promises", () => ({
   default: fsMock,
   ...fsMock,
}));
vi.mock("mime-types", () => ({
   default: mime,
   extension: mime.extension,
   lookup: mime.lookup,
}));
vi.mock("node:crypto", () => ({
   default: { randomUUID },
   randomUUID,
}));

describe("uuid + temp file modules", () => {
   beforeEach(() => {
      vi.resetModules();
      handlers.clear();
      ipcMain.handle.mockClear();
      app.getPath.mockClear();
      fsMock.readFile.mockReset();
      fsMock.writeFile.mockReset();
      fsMock.rm.mockReset();
      fsMock.mkdir.mockReset();
      fsMock.unlink.mockReset();
      fsMock.readdir.mockReset();
      mime.extension.mockClear();
      mime.lookup.mockClear();
      randomUUID.mockClear();
      vi.spyOn(Date, "now").mockReturnValue(1234);
      vi.spyOn(Math, "random").mockReturnValue(0.5);
   });

   it("returns existing UUID when file already exists", async () => {
      fsMock.readFile.mockResolvedValueOnce(
         JSON.stringify({ uuid: "uuid-old" }),
      );
      const { getOrCreateUuid } = await import("../electron/modules/uuid");

      await expect(getOrCreateUuid()).resolves.toBe("uuid-old");
      expect(fsMock.writeFile).not.toHaveBeenCalled();
   });

   it("creates and persists UUID when file is missing", async () => {
      fsMock.readFile.mockRejectedValueOnce({ code: "ENOENT" });
      const { getOrCreateUuid } = await import("../electron/modules/uuid");

      await expect(getOrCreateUuid()).resolves.toBe("uuid-generated");
      expect(randomUUID).toHaveBeenCalled();
      expect(fsMock.writeFile).toHaveBeenCalledWith(
         path.join("C:", "UserData", "student_uuid.json"),
         JSON.stringify({ uuid: "uuid-generated" }),
         { encoding: "utf-8" },
      );
   });

   it("registers get-student-uuid IPC handler", async () => {
      fsMock.readFile.mockResolvedValueOnce(
         JSON.stringify({ uuid: "uuid-cached" }),
      );
      const { setupUuid } = await import("../electron/modules/uuid");
      await setupUuid();

      expect(handlers.get("get-student-uuid")!()).toBe("uuid-cached");
   });

   it("writes, reads, and filters temp monitor log files", async () => {
      const { setupTempFiles } = await import("../electron/modules/temp-files");
      await setupTempFiles();

      const VIDEO_TEMP_DIR = path.join("C:", "Temp", "distract", "videos");
      const MONITOR_DIR = path.join("C:", "Temp", "distract", "monitor-logs");

      expect(fsMock.rm).toHaveBeenCalledWith(VIDEO_TEMP_DIR, {
         recursive: true,
         force: true,
      });
      expect(fsMock.rm).toHaveBeenCalledWith(MONITOR_DIR, {
         recursive: true,
         force: true,
      });

      const videoPath = await handlers.get("write-temp-video")!(
         null,
         Buffer.from("v"),
         "video/webm",
      );
      expect(videoPath).toBe(path.join(VIDEO_TEMP_DIR, "video_1234.webm"));
      expect(fsMock.writeFile).toHaveBeenCalledWith(
         path.join(VIDEO_TEMP_DIR, "video_1234.webm"),
         Buffer.from("v"),
      );

      fsMock.readFile.mockResolvedValueOnce(Buffer.from("video-data"));
      const readRes = await handlers.get("read-temp-video")!(null, videoPath);
      expect(readRes).toEqual({
         buffer: Buffer.from("video-data"),
         mimetype: "video/webm",
      });

      fsMock.readdir.mockResolvedValueOnce(["one.json", "ignore.txt"]);
      fsMock.readFile.mockResolvedValueOnce('{"transactionId":"t1"}');
      const logs = await handlers.get("get-temp-monitor-logs")!();
      expect(logs).toEqual([
         {
            filePath: path.join(MONITOR_DIR, "one.json"),
            data: { transactionId: "t1" },
         },
      ]);
   });

   it("rejects reads outside temp video dir and safely swallows delete errors", async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const { setupTempFiles } = await import("../electron/modules/temp-files");
      await setupTempFiles();

      await expect(
         handlers.get("read-temp-video")!(null, "C:\\outside\\clip.webm"),
      ).rejects.toThrow("outside of temp video directory");

      await handlers.get("cleanup-temp-video")!(null, "C:\\outside\\clip.webm");
      await handlers.get("delete-temp-monitor-log")!(
         null,
         "C:\\outside\\log.json",
      );

      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
   });
});
