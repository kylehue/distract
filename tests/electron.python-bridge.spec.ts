// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";

type IpcHandler = (...args: any[]) => any;

const ipcHandlers = new Map<string, IpcHandler>();

const ipcMain = {
   handle: vi.fn((channel: string, handler: IpcHandler) => {
      ipcHandlers.set(channel, handler);
   }),
};

const app = {
   on: vi.fn(),
   whenReady: vi.fn(async () => undefined),
};

class MockProc extends EventEmitter {
   stdout = new EventEmitter();
   stderr = new EventEmitter();
   stdin = {
      write: vi.fn((_chunk: string) => true),
   };
   killed = false;

   constructor(public pid: number) {
      super();
   }

   kill = vi.fn((_signal?: NodeJS.Signals | number) => {
      this.killed = true;
      queueMicrotask(() => {
         this.emit("exit", 0, null);
      });
      return true;
   });
}

const pythonProcQueue: MockProc[] = [];

const spawn = vi.fn((exe: string) => {
   if (exe === "taskkill") {
      return new MockProc(99999) as any;
   }

   const proc = pythonProcQueue.shift();
   if (!proc) {
      throw new Error("No mock python process available");
   }
   return proc as any;
});

vi.mock("electron", () => ({
   app,
   ipcMain,
}));

vi.mock("node:child_process", () => ({
   spawn,
}));

function parseWrites(proc: MockProc) {
   return proc.stdin.write.mock.calls.map(([chunk]: [string]) =>
      JSON.parse(String(chunk).trim()),
   );
}

function emitPythonMessage(proc: MockProc, msg: Record<string, any>) {
   proc.stdout.emit("data", `${JSON.stringify(msg)}\n`);
}

async function setupBridge(proc: MockProc) {
   const mainWindow = {
      isDestroyed: vi.fn(() => false),
      webContents: {
         send: vi.fn(),
      },
   };

   pythonProcQueue.push(proc);
   const bridge = await import("../electron/modules/python-bridge");

   const setupPromise = bridge.setupPythonBridge(mainWindow as any);
   await Promise.resolve();

   const warmupPayload = parseWrites(proc).find(
      (w) => w.type === "warmup_model",
   );
   expect(warmupPayload).toBeTruthy();
   emitPythonMessage(proc, {
      correlationId: warmupPayload.correlationId,
      value: "warmup_complete",
   });

   await setupPromise;

   return { bridge, mainWindow };
}

describe("electron/modules/python-bridge", () => {
   let oldNodeEnv: string | undefined;

   beforeEach(() => {
      vi.useRealTimers();
      vi.resetModules();

      oldNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      ipcHandlers.clear();
      ipcMain.handle.mockClear();
      app.on.mockClear();
      app.whenReady.mockClear();
      spawn.mockClear();

      pythonProcQueue.length = 0;
      (globalThis as any).__PY_PROC__ = null;
   });

   afterEach(() => {
      process.env.NODE_ENV = oldNodeEnv;
   });

   it("parses chunked stdout JSON without dropping correlation responses", async () => {
      const proc = new MockProc(1001);
      await setupBridge(proc);

      const pyInvoke = ipcHandlers.get("py-invoke")!;
      const pending = pyInvoke({}, { type: "ping", correlationId: "chunk-1" });

      proc.stdout.emit("data", '{"correlationId":"chunk-1","value":"po');
      proc.stdout.emit("data", 'ng"}\n');

      await expect(pending).resolves.toBe("pong");
   });

   it("rejects both active and queued invokes during forced termination", async () => {
      const proc = new MockProc(1002);
      await setupBridge(proc);

      const pyInvoke = ipcHandlers.get("py-invoke")!;
      const forceKill = ipcHandlers.get("py-force-kill")!;

      const p1 = pyInvoke({}, { type: "use_model", correlationId: "kill-1" });
      const p2 = pyInvoke({}, { type: "use_model", correlationId: "kill-2" });

      const p1Rejected = expect(p1).rejects.toThrow(
         "Renderer requested force kill",
      );
      const p2Rejected = expect(p2).rejects.toThrow(
         "Renderer requested force kill",
      );

      await forceKill();
      await p1Rejected;
      await p2Rejected;
   });

   it("recovers from timeout by resetting python so new requests can proceed", async () => {
      vi.useFakeTimers();

      const proc1 = new MockProc(1003);
      await setupBridge(proc1);

      const pyInvoke = ipcHandlers.get("py-invoke")!;
      const p1 = pyInvoke(
         {},
         { type: "use_model", correlationId: "timeout-1" },
      );
      const p1Rejected = expect(p1).rejects.toThrow("timed out");

      // Provide a replacement python process for post-timeout recovery.
      const proc2 = new MockProc(1004);
      pythonProcQueue.push(proc2);

      await vi.advanceTimersByTimeAsync(15_000);
      await p1Rejected;

      const p2 = pyInvoke({}, { type: "ping", correlationId: "timeout-2" });
      emitPythonMessage(proc2, {
         correlationId: "timeout-2",
         value: "pong",
      });

      await expect(p2).resolves.toBe("pong");
      expect(proc1.kill).toHaveBeenCalled();
   });
});
