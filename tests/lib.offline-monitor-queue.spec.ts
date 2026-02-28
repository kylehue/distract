import { ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
   MonitorQueue,
   type MonitorPayload,
} from "@/lib/monitor-queue";

function createSocket(isOnline = true) {
   return {
      isConnected: ref(isOnline),
      emitWithAck: vi.fn(),
   };
}

function samplePayload(tx = "tx-1"): MonitorPayload {
   return {
      uuid: "uuid-1",
      transactionId: tx,
      roomCode: "ABCD",
      scores: { warningLevel: "none" },
      isPhonePresent: false,
      mimetype: "video/webm",
      startTime: "2026-01-01T00:00:00.000Z",
      videoPath: `C:/tmp/${tx}.webm`,
      createdAt: "2026-01-01T00:00:01.000Z",
   };
}

describe("MonitorQueue", () => {
   beforeEach(() => {
      window.api.getTempMonitorLogs = vi.fn().mockResolvedValue([]);
      window.api.writeTempMonitorLog = vi.fn().mockResolvedValue("queued.json");
      window.api.deleteTempMonitorLog = vi.fn().mockResolvedValue(undefined);
      window.api.readTempVideo = vi.fn();
      window.api.cleanupTempVideo = vi.fn().mockResolvedValue(undefined);
      global.fetch = vi.fn();
      vi.restoreAllMocks();
   });

   it("hydrates only entries that contain both transactionId and videoPath", async () => {
      const socket = createSocket();
      const queue = new MonitorQueue(socket as any);

      (window.api.getTempMonitorLogs as any).mockResolvedValueOnce([
         { data: { transactionId: "tx-ok", videoPath: "C:/tmp/ok.webm" } },
         { data: { transactionId: "tx-missing" } },
         { data: { videoPath: "C:/tmp/missing.webm" } },
      ]);

      await queue.hydrateFromDisk();

      const pathMap = (queue as any).videoPathMap as Map<string, string>;
      expect(pathMap.get("tx-ok")).toBe("C:/tmp/ok.webm");
      expect(pathMap.has("tx-missing")).toBe(false);
   });

   it("queues monitor logs when offline", async () => {
      const socket = createSocket(false);
      const queue = new MonitorQueue(socket as any);

      await queue.sendOrQueueLog(samplePayload());

      expect(window.api.writeTempMonitorLog).toHaveBeenCalledWith(
         expect.objectContaining({ transactionId: "tx-1" }),
      );
      expect(socket.emitWithAck).not.toHaveBeenCalled();
   });

   it("cleans accepted no-evidence transaction after online ack", async () => {
      const socket = createSocket(true);
      socket.emitWithAck.mockResolvedValue({
         ok: true,
         shouldUploadVideo: false,
      });
      const queue = new MonitorQueue(socket as any);
      const cleanupSpy = vi.spyOn(queue, "cleanupTransaction");

      await queue.sendOrQueueLog(samplePayload("tx-clean"));

      expect(socket.emitWithAck).toHaveBeenCalledWith(
         "student:post_monitor_logs",
         expect.objectContaining({ transactionId: "tx-clean" }),
      );
      expect(cleanupSpy).toHaveBeenCalledWith("tx-clean");
   });

   it("falls back to disk queue when online emit throws", async () => {
      const socket = createSocket(true);
      socket.emitWithAck.mockRejectedValue(new Error("socket down"));
      const queue = new MonitorQueue(socket as any);

      await queue.sendOrQueueLog(samplePayload("tx-retry"));

      expect(window.api.writeTempMonitorLog).toHaveBeenCalledWith(
         expect.objectContaining({ transactionId: "tx-retry" }),
      );
   });

   it("flushes queued logs by chunk and deletes only accepted file paths", async () => {
      const socket = createSocket(true);
      const queue = new MonitorQueue(socket as any);

      (window.api.getTempMonitorLogs as any).mockResolvedValueOnce([
         { filePath: "a.json", data: samplePayload("a") },
         { filePath: "b.json", data: samplePayload("b") },
         { filePath: "c.json", data: samplePayload("c") },
      ]);

      socket.emitWithAck
         .mockResolvedValueOnce({ accepted: ["a"], failed: [] })
         .mockResolvedValueOnce({ accepted: ["c"], failed: [] });

      await queue.flushQueuedLogs({ chunkSize: 2, timeoutMs: 1234 });

      expect(socket.emitWithAck).toHaveBeenNthCalledWith(
         1,
         "student:post_monitor_logs_bulk",
         {
            logs: [samplePayload("a"), samplePayload("b")],
         },
         1234,
      );
      expect(socket.emitWithAck).toHaveBeenNthCalledWith(
         2,
         "student:post_monitor_logs_bulk",
         {
            logs: [samplePayload("c")],
         },
         1234,
      );
      expect(window.api.deleteTempMonitorLog).toHaveBeenCalledTimes(2);
      expect(window.api.deleteTempMonitorLog).toHaveBeenCalledWith("a.json");
      expect(window.api.deleteTempMonitorLog).toHaveBeenCalledWith("c.json");
   });

   it("stops flushing on first bulk error to retry later", async () => {
      const socket = createSocket(true);
      const queue = new MonitorQueue(socket as any);

      (window.api.getTempMonitorLogs as any).mockResolvedValueOnce([
         { filePath: "a.json", data: samplePayload("a") },
      ]);
      socket.emitWithAck.mockRejectedValueOnce(new Error("timeout"));

      await queue.flushQueuedLogs();

      expect(window.api.deleteTempMonitorLog).not.toHaveBeenCalled();
   });

   it("uploads using memory blob first and cleans up when PUT succeeds", async () => {
      const socket = createSocket(true);
      const queue = new MonitorQueue(socket as any);
      const blob = new Blob(["abc"], { type: "video/webm" });
      const cleanupSpy = vi.spyOn(queue, "cleanupTransaction");

      queue.rememberRecording("tx-upload", blob);
      (global.fetch as any).mockResolvedValueOnce({ ok: true });

      await queue.handleUploadRecordingUrl({
         transactionId: "tx-upload",
         url: "https://upload.url",
      });

      expect(global.fetch).toHaveBeenCalledWith("https://upload.url", {
         method: "PUT",
         headers: { "Content-Type": "video/webm" },
         body: blob,
      });
      expect(cleanupSpy).toHaveBeenCalledWith("tx-upload");
      expect(window.api.readTempVideo).not.toHaveBeenCalled();
   });

   it("warns and skips upload when no in-memory blob and no disk path", async () => {
      const socket = createSocket(true);
      const queue = new MonitorQueue(socket as any);
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      await queue.handleUploadRecordingUrl({
         transactionId: "unknown",
         url: "https://upload.url",
      });

      expect(warnSpy).toHaveBeenCalled();
      expect(global.fetch).not.toHaveBeenCalled();
      warnSpy.mockRestore();
   });
});
