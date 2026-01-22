import fs from "fs";
import path from "path";
import crypto from "crypto";
import { app, ipcMain } from "electron";
function getOrCreateUuid() {
   const userDataPath = app.getPath("userData");
   const uuidPath = path.join(userDataPath, "student_uuid.json");

   if (fs.existsSync(uuidPath)) {
      const data = JSON.parse(fs.readFileSync(uuidPath, "utf-8"));
      return data.uuid;
   }

   const uuid = crypto.randomUUID();
   fs.writeFileSync(uuidPath, JSON.stringify({ uuid }), "utf-8");
   return uuid;
}

export function setupUuid() {
   ipcMain.handle("get-student-uuid", () => getOrCreateUuid());
}
