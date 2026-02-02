import { app, BrowserWindow, ipcMain } from "electron";
import { spawn, ChildProcessWithoutNullStreams } from "node:child_process";
import path from "node:path";

const IS_DEV = process.env.NODE_ENV === "development";
const PY_PROD_PATH = path.join(
   IS_DEV ? process.cwd() : process.resourcesPath,
   "dist-py",
   "main.exe",
);

const pending = new Map<
   string,
   {
      resolve: (v: any) => void;
      reject: (e: any) => void;
   }
>();
let pyProc: ChildProcessWithoutNullStreams | null = null;
let bridgeInitialized = false;
declare global {
   // eslint-disable-next-line no-var
   var __PY_PROC__: ChildProcessWithoutNullStreams | null;
}

global.__PY_PROC__ ??= null;
export function startPython() {
   if (global.__PY_PROC__) {
      return global.__PY_PROC__;
   }

   const proc = spawn(PY_PROD_PATH);

   proc.stderr.on("data", (data) => {
      console.error("[python stderr]", data.toString());
   });

   proc.on("exit", () => {
      global.__PY_PROC__ = null;
   });

   global.__PY_PROC__ = proc;
   return proc;
}

function stopPython() {
   if (global.__PY_PROC__) {
      global.__PY_PROC__.kill();
      global.__PY_PROC__ = null;
   }
}

function sendToPython(msg: any) {
   if (!global.__PY_PROC__) throw new Error("Python not started");
   global.__PY_PROC__.stdin.write(JSON.stringify(msg) + "\n");
}
export function setupPythonBridge(mainWindow: BrowserWindow) {
   if (bridgeInitialized) return;
   bridgeInitialized = true;

   const pyProc = startPython();

   pyProc.stdout.on("data", (data) => {
      const lines = data.toString().trim().split("\n");

      for (const line of lines) {
         try {
            const msg = JSON.parse(line);

            if (msg.correlationId && pending.has(msg.correlationId)) {
               pending.get(msg.correlationId)!.resolve(msg.value);
               pending.delete(msg.correlationId);
               continue;
            }

            if (msg.type) {
               mainWindow.webContents.send(`py:${msg.type}`, msg);
            }
         } catch {
            console.log("[python raw]", line);
         }
      }
   });

   ipcMain.handle("py:invoke", async (_evt, payload) => {
      if (!global.__PY_PROC__) throw new Error("Python not running");

      return new Promise((resolve, reject) => {
         pending.set(payload.correlationId, { resolve, reject });
         sendToPython(payload);
      });
   });

   app.on("before-quit", () => {
      stopPython();
   });
}
