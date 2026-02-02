import { app, BrowserWindow, ipcMain } from "electron";
import { spawn, ChildProcessWithoutNullStreams } from "node:child_process";
import path from "node:path";

const IS_DEV = process.env.NODE_ENV === "development";

declare global {
   // eslint-disable-next-line no-var
   var __PY_PROC__: ChildProcessWithoutNullStreams | null;
}

global.__PY_PROC__ ??= null;
export function startPython() {
   if (global.__PY_PROC__) {
      return global.__PY_PROC__;
   }

   const proc = IS_DEV
      ? spawn(path.join(process.cwd(), "py", "venv", "Scripts", "python.exe"), [
           path.join(process.cwd(), "py", "main.py"),
        ])
      : spawn(path.join(process.resourcesPath, "dist-py", "main.exe"), []);

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

type PendingResolver = {
   resolve: (v: any) => void;
   reject: (e: any) => void;
};

type QueuedRequest = {
   payload: any;
   resolve: (v: any) => void;
   reject: (e: any) => void;
};

const pending = new Map<string, PendingResolver>();
const queue: QueuedRequest[] = [];
let activeCorrelationId: string | null = null;

function flushQueue() {
   if (!global.__PY_PROC__) return;
   if (activeCorrelationId) return; // Python busy
   if (queue.length === 0) return;

   const next = queue.shift()!;
   const cid = next.payload.correlationId;

   activeCorrelationId = cid;
   pending.set(cid, {
      resolve: next.resolve,
      reject: next.reject,
   });

   // send payload to python
   global.__PY_PROC__.stdin.write(JSON.stringify(next.payload) + "\n");
}

export function setupPythonBridge(mainWindow: BrowserWindow) {
   if (global.__PY_PROC__) return;

   const pyProc = startPython();

   pyProc.stdout.on("data", (data) => {
      const lines = data.toString().trim().split("\n");

      for (const line of lines) {
         if (!line.trim()) continue;
         try {
            const msg = JSON.parse(line);

            if (msg.correlationId && pending.has(msg.correlationId)) {
               pending.get(msg.correlationId)!.resolve(msg.value);
               pending.delete(msg.correlationId);

               activeCorrelationId = null;
               flushQueue();
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

   ipcMain.handle("py-invoke", async (_evt, payload) => {
      if (!global.__PY_PROC__) throw new Error("Python not running");

      return new Promise((resolve, reject) => {
         queue.push({ payload, resolve, reject });
         flushQueue();
      });
   });

   app.on("before-quit", () => {
      stopPython();
   });
}
