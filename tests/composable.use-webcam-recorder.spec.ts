import { mount } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@fix-webm-duration/fix", () => ({
   fixWebmDuration: vi.fn(async (blob: Blob) => blob),
}));

let supportedTypes = new Set<string>([
   "video/webm;codecs=vp9",
   "video/webm;codecs=vp9,opus",
   "video/webm;codecs=vp8,opus",
   "video/webm",
]);

const recorderInstances: any[] = [];

class FakeMediaRecorder {
   static isTypeSupported(type: string) {
      return supportedTypes.has(type);
   }

   public state: "inactive" | "recording" = "inactive";
   public ondataavailable: ((e: any) => void) | null = null;
   public onstop: (() => void) | null = null;
   public onerror: ((e: any) => void) | null = null;
   public options: any;

   constructor(_stream: MediaStream, options: any) {
      this.options = options;
      recorderInstances.push(this);
   }

   start() {
      this.state = "recording";
   }

   stop() {
      if (this.state !== "recording") return;
      this.state = "inactive";
      this.ondataavailable?.({
         data: new Blob(["clip"], {
            type: this.options.mimeType ?? "video/webm",
         }),
      });
      this.onstop?.();
   }
}

describe("useWebcamRecorder", () => {
   let getUserMediaSpy: ReturnType<typeof vi.fn>;
   let trackStopSpy: ReturnType<typeof vi.fn>;
   let api: any;

   beforeEach(async () => {
      vi.useFakeTimers();
      vi.resetModules();
      recorderInstances.length = 0;
      supportedTypes = new Set([
         "video/webm;codecs=vp9",
         "video/webm;codecs=vp9,opus",
         "video/webm;codecs=vp8,opus",
         "video/webm",
      ]);

      trackStopSpy = vi.fn();
      getUserMediaSpy = vi.fn().mockResolvedValue({
         getTracks: () => [{ stop: trackStopSpy }],
      });

      Object.defineProperty(globalThis, "MediaRecorder", {
         value: FakeMediaRecorder,
         configurable: true,
      });
      Object.defineProperty(navigator, "mediaDevices", {
         value: { getUserMedia: getUserMediaSpy },
         configurable: true,
      });

      const { useWebcamRecorder } =
         await import("@/app/composables/use-webcam-recorder");
      mount(
         defineComponent({
            setup() {
               api = useWebcamRecorder({ chunkIntervalMillis: 1000 });
               return () => h("div");
            },
         }),
      );
   });

   afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
   });

   it("starts and stops recording with stream lifecycle cleanup", async () => {
      await api.startRecording();
      expect(getUserMediaSpy).toHaveBeenCalled();
      expect(api.isRecording.value).toBe(true);
      expect(recorderInstances).toHaveLength(1);

      api.stopRecording();
      expect(api.isRecording.value).toBe(false);
      expect(trackStopSpy).toHaveBeenCalled();
   });

   it("falls back to alternative MIME type when preferred one is unsupported", async () => {
      supportedTypes = new Set(["video/webm;codecs=vp8,opus"]);

      await api.startRecording();

      expect(recorderInstances[0].options.mimeType).toBe(
         "video/webm;codecs=vp8,opus",
      );
   });

   it("throws when no supported recording format exists", async () => {
      supportedTypes = new Set();

      await expect(api.startRecording()).rejects.toThrow(
         "No supported video/audio recording format found",
      );
      expect(api.isRecording.value).toBe(false);
   });

   it("supports pause and resume transitions while recording", async () => {
      await api.startRecording();
      expect(api.isPaused.value).toBe(false);

      api.pauseRecording();
      expect(api.isPaused.value).toBe(true);

      api.resumeRecording();
      expect(api.isPaused.value).toBe(false);
      expect(recorderInstances.length).toBeGreaterThanOrEqual(2);
   });

   it("keeps notifying listeners even when one listener throws", async () => {
      const badListener = vi.fn(() => {
         throw new Error("listener fail");
      });
      const goodListener = vi.fn();
      const consoleSpy = vi
         .spyOn(console, "error")
         .mockImplementation(() => {});

      api.onClipReady(badListener);
      api.onClipReady(goodListener);

      await api.startRecording();
      api.stopRecording();
      await Promise.resolve();
      await Promise.resolve();

      expect(badListener).toHaveBeenCalled();
      expect(goodListener).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
   });
});
