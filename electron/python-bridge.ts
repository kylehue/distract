import { ipcMain } from "electron";
import { spawn, ChildProcessWithoutNullStreams } from "node:child_process";
import path from "node:path";

const isDev = process.env.NODE_ENV === "development";

// In dev → run Python script
const PY_DEV_CMD = process.platform === "win32" ? "python" : "python3";
const PY_DEV_SCRIPT = path.join(process.cwd(), "py", "main.py");

// In prod → run frozen exe
const PY_PROD_PATH = path.join(process.resourcesPath, "dist-py", "main.exe");

let pyProc: ChildProcessWithoutNullStreams | null = null;

export function startPython() {
   if (pyProc) return; // already running

   if (isDev) {
      pyProc = spawn(PY_DEV_CMD, [PY_DEV_SCRIPT]);
   } else {
      pyProc = spawn(PY_PROD_PATH, []);
   }

   pyProc.stdout.on("data", (data) => {
      console.log("[python stdout]", data.toString());
   });

   pyProc.stderr.on("data", (data) => {
      console.error("[python stderr]", data.toString());
   });

   pyProc.on("exit", (code) => {
      console.log(`Python exited with code ${code}`);
      pyProc = null;
   });
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

export function registerPythonHandlers() {
   startPython();

   // Example handler for "add"
   ipcMain.handle("py:add", async (_evt, { a, b }) => {
      return new Promise<number>((resolve, reject) => {
         if (!pyProc) return reject("Python not running");

         const listener = (data: Buffer) => {
            try {
               const msg = JSON.parse(data.toString());
               if (msg.type === "add_result") {
                  resolve(msg.value);
                  pyProc?.stdout.off("data", listener); // remove listener after response
               }
            } catch (err) {
               reject(err);
            }
         };

         pyProc.stdout.on("data", listener);

         sendToPython({ type: "add", a, b });
      });
   });
}
