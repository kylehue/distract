// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const exposed = new Map<string, any>();
const ipcRenderer = {
   on: vi.fn(
      (_channel: string, _listener: (...args: any[]) => void) => "on-ret",
   ),
   off: vi.fn(() => "off-ret"),
   send: vi.fn(() => "send-ret"),
   invoke: vi.fn(async () => "invoke-ret"),
   removeListener: vi.fn(),
};
const contextBridge = {
   exposeInMainWorld: vi.fn((key: string, value: any) => {
      exposed.set(key, value);
   }),
};

vi.mock("electron", () => ({
   ipcRenderer,
   contextBridge,
}));

describe("electron/preload", () => {
   beforeEach(() => {
      vi.resetModules();
      exposed.clear();
      ipcRenderer.on.mockClear();
      ipcRenderer.off.mockClear();
      ipcRenderer.send.mockClear();
      ipcRenderer.invoke.mockClear();
      ipcRenderer.removeListener.mockClear();
      contextBridge.exposeInMainWorld.mockClear();
   });

   it("exposes ipcRenderer bridge helpers", async () => {
      await import("../electron/preload");
      const ipc = exposed.get("ipcRenderer");

      const listener = vi.fn();
      expect(ipc.on("chan", listener)).toBe("on-ret");
      expect(ipc.off("chan", listener)).toBe("off-ret");
      expect(ipc.send("chan", { a: 1 })).toBe("send-ret");
      expect(await ipc.invoke("chan", { a: 1 })).toBe("invoke-ret");
      expect(ipcRenderer.on).toHaveBeenCalledWith("chan", expect.any(Function));
      expect(ipcRenderer.off).toHaveBeenCalledWith("chan", listener);
      expect(ipcRenderer.send).toHaveBeenCalledWith("chan", { a: 1 });
      expect(ipcRenderer.invoke).toHaveBeenCalledWith("chan", { a: 1 });
   });

   it("exposes app API utilities including pyInvoke and temp video serialization", async () => {
      vi.spyOn(Date, "now").mockReturnValue(1000);
      vi.spyOn(Math, "random").mockReturnValue(0.5);
      ipcRenderer.invoke.mockResolvedValue("ok");

      await import("../electron/preload");
      const api = exposed.get("api");

      await api.pyInvoke("use_model", { videoPath: "x.webm" });
      expect(ipcRenderer.invoke).toHaveBeenCalledWith(
         "py-invoke",
         expect.objectContaining({
            type: "use_model",
            videoPath: "x.webm",
            correlationId: expect.any(String),
         }),
      );

      const blob = new Blob(["abc"], { type: "video/webm" });
      await api.writeTempVideo(blob);
      expect(ipcRenderer.invoke).toHaveBeenCalledWith(
         "write-temp-video",
         expect.any(Buffer),
         "video/webm",
      );
   });

   it("routes on/off and splash status listeners to ipcRenderer channels", async () => {
      await import("../electron/preload");
      const api = exposed.get("api");
      const splash = exposed.get("splash");

      const appCb = vi.fn();
      api.on("py:error", appCb);
      const wrappedApiListener = ipcRenderer.on.mock.calls.at(-1)?.[1];
      wrappedApiListener?.({}, { reason: "fail" });
      expect(appCb).toHaveBeenCalledWith({ reason: "fail" });

      const offListener = vi.fn();
      api.off("py:error", offListener);
      expect(ipcRenderer.removeListener).toHaveBeenCalledWith(
         "py:error",
         offListener,
      );

      const splashCb = vi.fn();
      splash.onStatus(splashCb);
      const splashListener = ipcRenderer.on.mock.calls.at(-1)?.[1];
      splashListener?.({}, "Starting...");
      expect(splashCb).toHaveBeenCalledWith("Starting...");
   });
});
