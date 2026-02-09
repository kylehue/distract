import { app, ipcMain } from "electron";
import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";

export async function getOrCreateUuid(): Promise<string> {
   const userDataPath = app.getPath("userData");
   const uuidPath = path.join(userDataPath, "student_uuid.json");

   try {
      const raw = await fs.readFile(uuidPath, { encoding: "utf-8" });
      const data = JSON.parse(raw) as { uuid: string };
      return data.uuid;
   } catch (err: any) {
      if (err?.code !== "ENOENT") throw err;
   }

   const uuid = crypto.randomUUID();
   await fs.writeFile(uuidPath, JSON.stringify({ uuid }), {
      encoding: "utf-8",
   });
   return uuid;
}

export async function setupUuid() {
   const uuid = await getOrCreateUuid();
   ipcMain.handle("get-student-uuid", () => uuid);
}
