import { BrowserWindow, ipcMain } from "electron";
import { spawn, ChildProcessWithoutNullStreams } from "node:child_process";
import path from "node:path";

const isDev = process.env.NODE_ENV === "development";

// In dev → run Python script
const PY_DEV_CMD = path.join(
   process.cwd(),
   "py",
   "venv",
   "Scripts",
   "python.exe"
);
const PY_DEV_SCRIPT = path.join(process.cwd(), "py", "main.py");

// In prod → run frozen exe
const PY_PROD_PATH = path.join(process.resourcesPath, "dist-py", "main.exe");

let pyProc: ChildProcessWithoutNullStreams | null = null;

export function startPython() {
   if (pyProc) return pyProc; // already running

   if (isDev) {
      pyProc = spawn(PY_DEV_CMD, [PY_DEV_SCRIPT]);
   } else {
      pyProc = spawn(PY_PROD_PATH, []);
   }

   pyProc.stderr.on("data", (data) => {
      console.error("[python stderr]", data.toString());
   });

   pyProc.on("exit", (code) => {
      console.log(`Python exited with code ${code}`);
      pyProc = null;
   });

   return pyProc;
}

export function stopPython() {
   if (pyProc) {
      pyProc.kill();
      pyProc = null;
   }
}

// Sends a JSON message to Python
function sendToPython(msg: any) {
   if (!pyProc) throw new Error("Python not started");
   pyProc.stdin.write(JSON.stringify(msg) + "\n");
}

export function setupPythonBridge(mainWindow: BrowserWindow) {
   let pyProc = startPython();

   pyProc.stdout.on("data", (data) => {
      const lines = data.toString().trim().split("\n");
      for (const line of lines) {
         try {
            const msg = JSON.parse(line);

            if (msg.type) {
               // 🚀 generic forwarding:
               mainWindow.webContents.send(`py:${msg.type}`, msg);
            } else {
               console.log("[python stdout]", msg);
            }
         } catch (err) {
            console.log("[python raw]", line);
         }
      }
   });

   // Generic request/response
   ipcMain.handle("py:invoke", async (_evt, payload) => {
      return new Promise<any>((resolve, reject) => {
         if (!pyProc) return reject("Python not running");

         const listener = (data: Buffer) => {
            try {
               const msg = JSON.parse(data.toString());
               if (msg.correlationId === payload.correlationId) {
                  resolve(msg.value);
                  pyProc?.stdout.off("data", listener);
               }
            } catch (err) {
               reject(err);
            }
         };

         pyProc.stdout.on("data", listener);
         sendToPython(payload);
      });
   });
}
