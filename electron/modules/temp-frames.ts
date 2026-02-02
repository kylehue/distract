import { ipcMain, app } from "electron";
import fs from "node:fs/promises";
import path from "node:path";

export function setupTempFrames() {
   ipcMain.handle(
      "write-temp-frames",
      async (_event, buffers: ArrayBuffer[]) => {
         const tempDir = path.join(app.getPath("temp"), "distract-frames");
         await fs.mkdir(tempDir, { recursive: true });

         const paths: string[] = [];

         for (let i = 0; i < buffers.length; i++) {
            const buffer = Buffer.from(buffers[i]);
            const filePath = path.join(tempDir, `frame_${Date.now()}_${i}.jpg`);
            await fs.writeFile(filePath, buffer);
            paths.push(filePath);
         }

         return paths;
      },
   );

   ipcMain.handle("cleanup-temp-frames", async (_e, framePaths: string[]) => {
      if (!framePaths.length) return;

      const dir = path.dirname(framePaths[0]);
      await fs.rm(dir, { recursive: true, force: true });
   });
}
