import { ipcMain, app } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import mime from "mime-types";

const VIDEO_TEMP_DIR = path.join(app.getPath("temp"), "distract", "videos");
const MONITOR_LOG_TEMP_DIR = path.join(
   app.getPath("temp"),
   "distract",
   "monitor-logs",
);

export async function setupTempFiles() {
   // wipe old temp on app start
   await fs.rm(VIDEO_TEMP_DIR, { recursive: true, force: true });
   await fs.rm(MONITOR_LOG_TEMP_DIR, { recursive: true, force: true });

   ipcMain.handle(
      "write-temp-video",
      async (_event, buffer: Buffer, mimetype: string) => {
         await fs.mkdir(VIDEO_TEMP_DIR, { recursive: true });

         const ext = mime.extension(mimetype) || "webm";
         const filePath = path.join(
            VIDEO_TEMP_DIR,
            `video_${Date.now()}.${ext}`,
         );
         await fs.writeFile(filePath, buffer);

         return filePath;
      },
   );

   ipcMain.handle("read-temp-video", async (_e, videoPath: string) => {
      try {
         if (!videoPath.startsWith(VIDEO_TEMP_DIR)) {
            throw new Error(
               "Attempted to read file outside of temp video directory",
            );
         }

         const buffer = await fs.readFile(videoPath);

         // best effort mimetype inference
         const ext = path.extname(videoPath).slice(1);
         const inferred =
            (ext ? mime.lookup(ext) : false) || "application/octet-stream";

         return { buffer, mimetype: inferred };
      } catch (e) {
         console.error("Failed to read temp video:", e);
         throw e;
      }
   });

   ipcMain.handle("cleanup-temp-video", async (_e, videoPath: string) => {
      try {
         if (videoPath.startsWith(VIDEO_TEMP_DIR)) {
            await fs.unlink(videoPath);
         } else {
            throw new Error(
               "Attempted to delete file outside of temp video directory",
            );
         }
      } catch (e) {
         console.error("Failed to cleanup temp video:", e);
      }
   });

   ipcMain.handle(
      "write-temp-monitor-log",
      async (_event, data: Record<any, any>) => {
         await fs.mkdir(MONITOR_LOG_TEMP_DIR, { recursive: true });

         const filePath = path.join(
            MONITOR_LOG_TEMP_DIR,
            `monitor_log_${Date.now()}_${Math.random().toString(16).slice(2)}.json`,
         );
         await fs.writeFile(filePath, JSON.stringify(data), "utf-8");

         return filePath;
      },
   );

   ipcMain.handle("get-temp-monitor-logs", async () => {
      try {
         const files = await fs.readdir(MONITOR_LOG_TEMP_DIR).catch(() => []);
         const logs: { filePath: string; data: any }[] = [];

         for (const file of files) {
            if (!file.endsWith(".json")) continue;

            const filePath = path.join(MONITOR_LOG_TEMP_DIR, file);
            const content = await fs.readFile(filePath, "utf-8");
            logs.push({ filePath, data: JSON.parse(content) });
         }

         return logs;
      } catch (e) {
         console.error("Failed to get temp monitor logs:", e);
         throw e;
      }
   });

   ipcMain.handle("delete-temp-monitor-log", async (_e, filePath: string) => {
      try {
         if (filePath.startsWith(MONITOR_LOG_TEMP_DIR)) {
            await fs.unlink(filePath);
         } else {
            throw new Error(
               "Attempted to delete file outside of temp monitor log directory",
            );
         }
      } catch (e) {
         console.error("Failed to delete temp monitor log:", e);
      }
   });

   ipcMain.handle("cleanup-temp-monitor-logs", async (_e) => {
      try {
         await fs.rm(MONITOR_LOG_TEMP_DIR, { recursive: true, force: true });
      } catch (e) {
         console.error("Failed to cleanup temp monitor logs:", e);
      }
   });
}
