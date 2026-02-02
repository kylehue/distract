import { ipcMain, app } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import mime from "mime-types";

const VIDEO_TEMP_DIR = path.join(app.getPath("temp"), "distract-videos");

export async function setupTempFiles() {
   // wipe old temp video on app start
   await fs.rm(VIDEO_TEMP_DIR, { recursive: true, force: true });
   await fs.mkdir(VIDEO_TEMP_DIR, { recursive: true });

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
}
