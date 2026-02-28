import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildNaiveUiStubs } from "./support/ui-stubs";
import { createSocketHarness } from "./support/socket-harness";

const pushSpy = vi.fn();
const messageErrorSpy = vi.fn();
const messageSuccessSpy = vi.fn();
const socketHarness = createSocketHarness();

const startRecordingSpy = vi.fn();
const stopRecordingSpy = vi.fn();
const onClipReadySpy = vi.fn();

const offlineInstance = {
   hydrateFromDisk: vi.fn().mockResolvedValue(undefined),
   flushQueuedLogs: vi.fn().mockResolvedValue(undefined),
   clearMemoryOnly: vi.fn(),
   rememberRecording: vi.fn(),
   rememberVideoPath: vi.fn(),
   sendOrQueueLog: vi.fn().mockResolvedValue(undefined),
   handleUploadRecordingUrl: vi.fn().mockResolvedValue(undefined),
};

vi.mock("vue-router", () => ({
   useRouter: () => ({ push: pushSpy }),
   useRoute: () => ({
      params: { roomCode: "ABCD" },
      query: { studentName: "Kyle" },
   }),
}));

vi.mock("@/app/composables/use-socket", () => ({
   useSocket: () => socketHarness.socketApi,
}));

vi.mock("@/app/composables/use-ping", () => ({
   usePing: () => ({ latency: 42 }),
}));

vi.mock("@/app/composables/use-interval", () => ({
   useInterval: vi.fn(),
}));

vi.mock("@/app/composables/use-webcam-recorder", () => ({
   useWebcamRecorder: () => ({
      startRecording: startRecordingSpy,
      stopRecording: stopRecordingSpy,
      onClipReady: onClipReadySpy,
   }),
}));

vi.mock("@/lib/monitor-queue", () => ({
   MonitorQueue: vi.fn(() => offlineInstance),
}));

vi.mock("naive-ui", () => ({
   ...buildNaiveUiStubs(),
   useMessage: () => ({
      error: messageErrorSpy,
      success: messageSuccessSpy,
   }),
}));

import RoomPage from "@/app/pages/room.vue";

function setupSuccessfulJoin() {
   socketHarness.emitWithAck.mockImplementation(async (event: string) => {
      if (event === "student:join_room") {
         return {
            room: { code: "ABCD", title: "Math", status: "pending" },
            teacher: { displayName: "Mr. T" },
            student: { name: "Kyle", permitted: false, lockMonitorLogId: null },
         };
      }
      if (event === "student:leave_room") return { ok: true };
      return {};
   });
}

describe("Room Page", () => {
   let consoleLogSpy: ReturnType<typeof vi.spyOn>;

   beforeEach(() => {
      socketHarness.reset();
      consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      pushSpy.mockReset();
      messageErrorSpy.mockReset();
      messageSuccessSpy.mockReset();
      socketHarness.emitWithAck.mockReset();
      socketHarness.on.mockClear();
      startRecordingSpy.mockReset();
      stopRecordingSpy.mockReset();
      onClipReadySpy.mockReset();
      offlineInstance.hydrateFromDisk.mockClear();
      offlineInstance.flushQueuedLogs.mockClear();
      offlineInstance.clearMemoryOnly.mockClear();
      offlineInstance.rememberRecording.mockClear();
      offlineInstance.rememberVideoPath.mockClear();
      offlineInstance.sendOrQueueLog.mockClear();
      offlineInstance.handleUploadRecordingUrl.mockClear();

      window.api.getUuid = vi.fn().mockResolvedValue("uuid-1");
      window.api.writeTempVideo = vi.fn().mockResolvedValue("video.webm");
      window.api.pyInvoke = vi.fn().mockResolvedValue({
         scores: [],
         isPhonePresent: false,
      });
      window.api.setShowCloseWarningDialog = vi.fn();
      window.api.lockWindow = vi.fn();
      window.api.unlockWindow = vi.fn();
   });

   afterEach(() => {
      consoleLogSpy.mockRestore();
   });

   it("renders pending approval then updates UI on real-time approve + monitoring", async () => {
      setupSuccessfulJoin();
      const wrapper = mount(RoomPage, {
         global: { stubs: { Loader: { template: "<div>loader</div>" } } },
      });
      await nextTick();
      await nextTick();

      expect(wrapper.text()).toContain(
         "Your join request is pending approval from the teacher.",
      );

      await socketHarness.trigger("student:upsert_student", {
         student: { permitted: true },
      });
      await socketHarness.trigger("student:upsert_room", {
         room: { status: "monitoring" },
      });
      await nextTick();

      expect(wrapper.text()).toContain("You are currently being monitored.");
      expect(startRecordingSpy).toHaveBeenCalled();
      expect(window.api.setShowCloseWarningDialog).toHaveBeenCalledWith(true);
   });

   it("shows locked state, stops recording, and locks window", async () => {
      setupSuccessfulJoin();
      const wrapper = mount(RoomPage, {
         global: { stubs: { Loader: { template: "<div>loader</div>" } } },
      });
      await nextTick();
      await nextTick();

      await socketHarness.trigger("student:upsert_student", {
         student: { lockMonitorLogId: "lock-1" },
      });
      await nextTick();

      expect(wrapper.text()).toContain(
         "Your system has been locked due to suspicious behavior.",
      );
      expect(stopRecordingSpy).toHaveBeenCalled();
      expect(window.api.lockWindow).toHaveBeenCalled();
   });

   it("routes to home and shows message when teacher rejects student", async () => {
      setupSuccessfulJoin();
      mount(RoomPage, {
         global: { stubs: { Loader: { template: "<div>loader</div>" } } },
      });
      await nextTick();
      await nextTick();

      await socketHarness.trigger("student:room_reject");

      expect(messageErrorSpy).toHaveBeenCalledWith(
         "You have been forbidden from joining the room.",
      );
      expect(pushSpy).toHaveBeenCalledWith("/");
   });

   it("rejoins and flushes queued logs on socket reconnect", async () => {
      setupSuccessfulJoin();
      mount(RoomPage, {
         global: { stubs: { Loader: { template: "<div>loader</div>" } } },
      });
      await nextTick();
      await nextTick();
      socketHarness.emitWithAck.mockClear();
      offlineInstance.flushQueuedLogs.mockClear();

      await socketHarness.trigger("connect");

      expect(socketHarness.emitWithAck).toHaveBeenCalledWith(
         "student:join_room",
         { roomCode: "ABCD", studentName: "Kyle" },
         5000,
      );
      expect(offlineInstance.flushQueuedLogs).toHaveBeenCalled();
   });

   it("leaves room successfully and cleans recorder/offline memory", async () => {
      setupSuccessfulJoin();
      const wrapper = mount(RoomPage, {
         global: { stubs: { Loader: { template: "<div>loader</div>" } } },
      });
      await nextTick();
      await nextTick();
      socketHarness.emitWithAck.mockClear();

      const leaveButton = wrapper.get("button");
      expect(leaveButton.attributes("disabled")).toBeUndefined();
      await leaveButton.trigger("click");
      await nextTick();

      expect(stopRecordingSpy).toHaveBeenCalled();
      expect(offlineInstance.clearMemoryOnly).toHaveBeenCalled();
      expect(socketHarness.emitWithAck).toHaveBeenCalledWith(
         "student:leave_room",
         {},
         5000,
      );
      expect(pushSpy).toHaveBeenCalledWith("/");
   });

   it("disables leave button when monitoring starts", async () => {
      setupSuccessfulJoin();
      const wrapper = mount(RoomPage, {
         global: { stubs: { Loader: { template: "<div>loader</div>" } } },
      });
      await nextTick();
      await nextTick();

      await socketHarness.trigger("student:upsert_student", {
         student: { permitted: true },
      });
      await socketHarness.trigger("student:upsert_room", {
         room: { status: "monitoring" },
      });
      await nextTick();

      expect(wrapper.get("button").attributes("disabled")).toBeDefined();
   });

   it("redirects home and shows error when initial join fails", async () => {
      socketHarness.emitWithAck.mockRejectedValueOnce(new Error("join failed"));
      mount(RoomPage, {
         global: { stubs: { Loader: { template: "<div>loader</div>" } } },
      });
      await nextTick();
      await nextTick();

      expect(messageErrorSpy).toHaveBeenCalledWith(
         "Failed to join the room. Please try again.",
      );
      expect(pushSpy).toHaveBeenCalledWith("/");
   });

   it("routes home on room deletion and only uploads evidence when permitted", async () => {
      setupSuccessfulJoin();
      mount(RoomPage, {
         global: { stubs: { Loader: { template: "<div>loader</div>" } } },
      });
      await nextTick();
      await nextTick();

      await socketHarness.trigger("student:upload_recording_url", {
         transactionId: "tx-1",
         url: "https://upload",
      });
      expect(offlineInstance.handleUploadRecordingUrl).not.toHaveBeenCalled();

      await socketHarness.trigger("student:upsert_student", {
         student: { permitted: true },
      });
      await socketHarness.trigger("student:upload_recording_url", {
         transactionId: "tx-2",
         url: "https://upload",
      });
      expect(offlineInstance.handleUploadRecordingUrl).toHaveBeenCalledWith({
         transactionId: "tx-2",
         url: "https://upload",
      });

      await socketHarness.trigger("student:delete_room");
      expect(messageErrorSpy).toHaveBeenCalledWith(
         "The room has been deleted by the teacher.",
      );
      expect(pushSpy).toHaveBeenCalledWith("/");
   });

   it("shows error and stays in page when leave room fails", async () => {
      socketHarness.emitWithAck.mockImplementation(async (event: string) => {
         if (event === "student:join_room") {
            return {
               room: { code: "ABCD", title: "Math", status: "pending" },
               teacher: { displayName: "Mr. T" },
               student: {
                  name: "Kyle",
                  permitted: false,
                  lockMonitorLogId: null,
               },
            };
         }
         if (event === "student:leave_room") {
            throw new Error("leave failed");
         }
         return {};
      });

      const wrapper = mount(RoomPage, {
         global: { stubs: { Loader: { template: "<div>loader</div>" } } },
      });
      await nextTick();
      await nextTick();

      await wrapper.get("button").trigger("click");
      await nextTick();

      expect(messageErrorSpy).toHaveBeenCalledWith(
         "Failed to leave the room. Please try again.",
      );
      expect(pushSpy).not.toHaveBeenCalledWith("/");
   });
});
