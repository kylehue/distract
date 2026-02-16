import { mount } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const emitWithAck = vi.fn();

vi.mock("@/app/composables/use-socket", () => ({
   useSocket: () => ({
      emitWithAck,
   }),
}));

describe("usePing", () => {
   beforeEach(() => {
      vi.resetModules();
      vi.useFakeTimers();
      emitWithAck.mockReset();
   });

   afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
   });

   it("updates latency on successful ping and schedules next ping", async () => {
      let now = 1_000;
      vi.spyOn(Date, "now").mockImplementation(() => now);
      emitWithAck.mockImplementation(async () => {
         now += 120;
      });

      const { usePing } = await import("@/app/composables/use-ping");
      let latencyRef: any;
      const wrapper = mount(
         defineComponent({
            setup() {
               latencyRef = usePing().latency;
               return () => h("div");
            },
         }),
      );

      await Promise.resolve();
      await Promise.resolve();
      expect(emitWithAck).toHaveBeenCalledWith("ping", {}, 9999);
      expect(latencyRef.value).toBe(120);

      await vi.advanceTimersByTimeAsync(3000);
      expect(emitWithAck).toHaveBeenCalledTimes(2);
      wrapper.unmount();
   });

   it("sets max latency when ping fails", async () => {
      emitWithAck.mockRejectedValue(new Error("timeout"));
      const { usePing } = await import("@/app/composables/use-ping");
      let pingRef: any;

      mount(
         defineComponent({
            setup() {
               pingRef = usePing().latency;
               return () => h("div");
            },
         }),
      );

      await Promise.resolve();
      await Promise.resolve();
      expect(pingRef.value).toBe(9999);
   });

   it("stops ping loop after unmount", async () => {
      emitWithAck.mockResolvedValue(undefined);
      const { usePing } = await import("@/app/composables/use-ping");

      const wrapper = mount(
         defineComponent({
            setup() {
               usePing();
               return () => h("div");
            },
         }),
      );
      await Promise.resolve();
      expect(emitWithAck).toHaveBeenCalledTimes(1);

      wrapper.unmount();
      await vi.advanceTimersByTimeAsync(10_000);
      expect(emitWithAck).toHaveBeenCalledTimes(1);
   });
});

describe("useInterval", () => {
   beforeEach(() => {
      vi.useFakeTimers();
   });

   afterEach(() => {
      vi.useRealTimers();
   });

   it("runs interval callback only while component is mounted", async () => {
      const { useInterval } = await import("@/app/composables/use-interval");
      const tick = vi.fn();

      const wrapper = mount(
         defineComponent({
            setup() {
               useInterval(tick, 1000);
               return () => h("div");
            },
         }),
      );

      await vi.advanceTimersByTimeAsync(3100);
      expect(tick).toHaveBeenCalledTimes(3);

      wrapper.unmount();
      await vi.advanceTimersByTimeAsync(3000);
      expect(tick).toHaveBeenCalledTimes(3);
   });
});
