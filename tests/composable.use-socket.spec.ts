import { mount } from "@vue/test-utils";
import { defineComponent, h, nextTick, ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

let mockSocket: any;
const connectedRef = ref(false);

vi.mock("@/lib/socket", () => ({
   get socket() {
      return Promise.resolve(mockSocket);
   },
   isConnected: connectedRef,
}));

describe("useSocket", () => {
   beforeEach(() => {
      vi.resetModules();
      connectedRef.value = false;
      mockSocket = {
         on: vi.fn(),
         off: vi.fn(),
         emit: vi.fn(),
         timeout: vi.fn().mockReturnThis(),
         emitWithAck: vi.fn().mockResolvedValue({ snake_value: 1 }),
      };
   });

   it("converts inbound payload keys to camelCase and auto-cleans on unmount", async () => {
      const received = vi.fn();
      const { useSocket } = await import("@/app/composables/use-socket");

      const Comp = defineComponent({
         setup() {
            const socket = useSocket();
            void socket.on("student:event", received);
            return () => h("div");
         },
      });

      const wrapper = mount(Comp);
      await nextTick();

      const handler = mockSocket.on.mock.calls.find(
         ([event]: [string]) => event === "student:event",
      )?.[1];
      expect(handler).toBeTypeOf("function");

      await handler({ student_name: "Kyle" });
      expect(received).toHaveBeenCalledWith({ studentName: "Kyle" });

      wrapper.unmount();
      await Promise.resolve();

      expect(mockSocket.off).toHaveBeenCalledWith("student:event", handler);
   });

   it("supports emit and emitWithAck with unref payloads", async () => {
      const { useSocket } = await import("@/app/composables/use-socket");
      let api: ReturnType<typeof useSocket>;

      mount(
         defineComponent({
            setup() {
               api = useSocket();
               return () => h("div");
            },
         }),
      );

      await api!.emit("student:keep_alive", ref({ room_code: "ABCD" }) as any);
      expect(mockSocket.emit).toHaveBeenCalledWith("student:keep_alive", {
         room_code: "ABCD",
      });

      const ack = await api!.emitWithAck<{ snakeValue: number }>(
         "student:ack",
         { test_value: 1 },
         3456,
      );
      expect(mockSocket.timeout).toHaveBeenCalledWith(3456);
      expect(mockSocket.emitWithAck).toHaveBeenCalledWith("student:ack", {
         test_value: 1,
      });
      expect(ack).toEqual({ snakeValue: 1 });
   });

   it("reflects shared connection state from lib/socket", async () => {
      const { useSocket } = await import("@/app/composables/use-socket");
      let api: ReturnType<typeof useSocket>;

      mount(
         defineComponent({
            setup() {
               api = useSocket();
               return () => h("div");
            },
         }),
      );

      expect(api!.isConnected.value).toBe(false);
      connectedRef.value = true;
      await nextTick();
      expect(api!.isConnected.value).toBe(true);
   });
});
