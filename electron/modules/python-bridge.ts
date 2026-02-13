import { app, BrowserWindow, ipcMain } from "electron";
import {
   spawn,
   ChildProcessWithoutNullStreams,
   spawn as spawnChild,
} from "node:child_process";
import path from "node:path";

const IS_DEV = process.env.NODE_ENV === "development";

declare global {
   // eslint-disable-next-line no-var
   var __PY_PROC__: ChildProcessWithoutNullStreams | null;
}

global.__PY_PROC__ ??= null;

// -------------------------
// Process control
// -------------------------
export function startPython() {
   if (global.__PY_PROC__) return global.__PY_PROC__;

   const exe = IS_DEV
      ? path.join(process.cwd(), "py", "venv", "Scripts", "python.exe")
      : path.join(process.resourcesPath, "dist-py", "main.exe");

   const args = IS_DEV ? [path.join(process.cwd(), "py", "main.py")] : [];

   const proc = spawn(exe, args, {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
      // On macOS/Linux: makes a new process group so we can SIGKILL the whole group
      detached: process.platform !== "win32",
   });

   proc.stderr.on("data", (data) => {
      console.error("[python stderr]", data.toString());
   });

   proc.on("exit", (code, signal) => {
      console.log("[python exit]", { code, signal });
      global.__PY_PROC__ = null;
   });

   proc.on("error", (err) => {
      console.error("[python error]", err);
   });

   global.__PY_PROC__ = proc;
   return proc;
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

function rejectAllPending(err: Error) {
   for (const [, pr] of pending) pr.reject(err);
   pending.clear();
   queue.length = 0;
   activeCorrelationId = null;
}

function flushQueue() {
   if (!global.__PY_PROC__) return;
   if (activeCorrelationId) return; // Python busy
   if (queue.length === 0) return;

   const next = queue.shift()!;
   const cid = next.payload.correlationId;

   activeCorrelationId = cid;
   pending.set(cid, { resolve: next.resolve, reject: next.reject });

   try {
      global.__PY_PROC__.stdin.write(JSON.stringify(next.payload) + "\n");
   } catch (e) {
      // If stdin is broken, fail fast
      pending.get(cid)?.reject(e);
      pending.delete(cid);
      activeCorrelationId = null;
      flushQueue();
   }
}

function withTimeout<T>(
   p: Promise<T>,
   ms: number,
   label = "timeout",
): Promise<T> {
   let t: NodeJS.Timeout | null = null;
   const timeout = new Promise<T>((_resolve, reject) => {
      t = setTimeout(() => reject(new Error(label)), ms);
   });
   return Promise.race([p, timeout]).finally(() => {
      if (t) clearTimeout(t);
   });
}

function invokePy(payload: any, timeoutMs = 15_000) {
   const cid = payload.correlationId ?? crypto.randomUUID();
   const full = { ...payload, correlationId: cid };

   const base = new Promise((resolve, reject) => {
      queue.push({ payload: full, resolve, reject });
      flushQueue();
   });

   return withTimeout(
      base,
      timeoutMs,
      `Python invoke timed out after ${timeoutMs}ms (${payload.type ?? "unknown"})`,
   ).catch((e) => {
      // IMPORTANT: cleanup so the bridge doesn't get stuck after a timeout
      if (pending.has(cid)) pending.delete(cid);
      if (activeCorrelationId === cid) activeCorrelationId = null;
      flushQueue();
      throw e;
   });
}

function waitForExit(proc: ChildProcessWithoutNullStreams, ms: number) {
   return new Promise<boolean>((resolve) => {
      const t = setTimeout(() => resolve(false), ms);
      proc.once("exit", () => {
         clearTimeout(t);
         resolve(true);
      });
   });
}

/**
 * Terminates python:
 * - tries graceful (SIGTERM / default kill)
 * - if it doesn't exit quickly (or force=true), force-kills (SIGKILL or taskkill /T /F)
 * - rejects all pending invoke promises and clears queue state
 */
export async function terminatePython(opts?: {
   force?: boolean;
   reason?: string;
   graceMs?: number;
}) {
   const proc = global.__PY_PROC__;
   if (!proc) return;

   const reason = opts?.reason ?? "Python terminated";
   const graceMs = opts?.graceMs ?? 800;
   const err = new Error(reason);

   // Stop the JS side from waiting forever
   rejectAllPending(err);

   // If already dead, cleanup
   if (proc.killed) {
      global.__PY_PROC__ = null;
      return;
   }

   // Stage 1: graceful
   try {
      if (process.platform === "win32") {
         proc.kill(); // best-effort on Windows
      } else {
         proc.kill("SIGTERM");
      }
   } catch {}

   let exited = await waitForExit(proc, graceMs);

   // Stage 2: force
   if (!exited || opts?.force) {
      try {
         if (process.platform === "win32") {
            // Kill process tree, force
            spawnChild("taskkill", ["/PID", String(proc.pid), "/T", "/F"], {
               windowsHide: true,
               stdio: "ignore",
            });
         } else {
            // Prefer killing process group if detached
            try {
               process.kill(-proc.pid!, "SIGKILL");
            } catch {
               proc.kill("SIGKILL");
            }
         }
      } catch {}
      // Give it a moment to actually die
      await waitForExit(proc, 500).catch(() => {});
   }

   global.__PY_PROC__ = null;
}

// -------------------------
// Bridge setup
// -------------------------
let bridgeInitialized = false;

export async function setupPythonBridge(mainWindow: BrowserWindow) {
   if (bridgeInitialized) return;
   bridgeInitialized = true;

   const pyProc = startPython();

   pyProc.stdout.on("data", (data) => {
      const lines = data.toString().split("\n");

      for (const line of lines) {
         const s = line.trim();
         if (!s) continue;

         try {
            const msg = JSON.parse(s);

            // reply to invokePy
            if (msg.correlationId && pending.has(msg.correlationId)) {
               pending.get(msg.correlationId)!.resolve(msg.value);
               pending.delete(msg.correlationId);

               activeCorrelationId = null;
               flushQueue();
               continue;
            }

            // push event to renderer
            if (msg.type) {
               mainWindow.webContents.send(`py:${msg.type}`, msg);
            }
         } catch {
            console.log("[python raw]", s);
         }
      }
   });

   ipcMain.handle("py-invoke", async (_evt, payload) => {
      if (!global.__PY_PROC__) throw new Error("Python not running");
      return invokePy(payload);
   });

   // Optional: give yourself a way to kill python from renderer for emergency reset/debug
   ipcMain.handle("py-force-kill", async () => {
      await terminatePython({
         force: true,
         reason: "Renderer requested force kill",
      });
      return true;
   });

   // Prefer graceful app shutdown path
   app.on("before-quit", () => {
      // Don't await here unless you preventDefault in your main file.
      terminatePython({ force: true, reason: "App quitting" });
   });

   await warmupPython();
}

async function warmupPython() {
   await app.whenReady();

   // warmup can take long, timeout is 1 hour
   const res = await invokePy({ type: "warmup_model" }, 1000 * 60 * 60);

   if (res !== "warmup_complete") {
      throw new Error(
         `Python warmup failed: expected "warmup_complete", got ${JSON.stringify(res)}`,
      );
   }

   console.log("[python] warmup OK");
}
