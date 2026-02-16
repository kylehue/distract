import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
   buildNaiveUiStubs,
   NButtonStub,
   NFormItemStub,
   NFormStub,
   NInputStub,
} from "./support/ui-stubs";
import { createSocketHarness } from "./support/socket-harness";

const pushSpy = vi.fn();
const messageErrorSpy = vi.fn();
const socketHarness = createSocketHarness();

vi.mock("vue-router", () => ({
   useRouter: () => ({ push: pushSpy }),
}));

vi.mock("@/app/composables/use-socket", () => ({
   useSocket: () => socketHarness.socketApi,
}));

vi.mock("naive-ui", () => ({
   ...buildNaiveUiStubs(),
   NInput: NInputStub,
   NButton: NButtonStub,
   NForm: NFormStub,
   NFormItem: NFormItemStub,
   useMessage: () => ({ error: messageErrorSpy }),
}));

vi.mock("@phosphor-icons/vue", () => ({
   PhHouseSimple: { template: "<i />" },
   PhUser: { template: "<i />" },
}));

import EntryPage from "@/app/pages/entry.vue";

describe("Entry Page", () => {
   beforeEach(() => {
      socketHarness.reset();
      pushSpy.mockReset();
      messageErrorSpy.mockReset();
      socketHarness.emitWithAck.mockReset();
   });

   it("pushes to room page on successful join", async () => {
      socketHarness.emitWithAck.mockResolvedValueOnce({
         room: { code: "ABCD" },
         student: { name: "Kyle" },
      });
      const wrapper = mount(EntryPage);

      const inputs = wrapper.findAll("input");
      await inputs[0].setValue("Kyle");
      await inputs[1].setValue("ABCD");
      await wrapper.get("button").trigger("click");

      expect(socketHarness.emitWithAck).toHaveBeenCalledWith(
         "student:join_room",
         { studentName: "Kyle", roomCode: "ABCD" },
         5000,
      );
      expect(pushSpy).toHaveBeenCalledWith({
         path: "/room/ABCD",
         query: { studentName: "Kyle" },
      });
   });

   it("shows field feedback from server validation errors", async () => {
      socketHarness.emitWithAck.mockResolvedValueOnce({
         fieldErrors: {
            studentName: "Name required",
            roomCode: "Invalid code",
         },
      });
      const wrapper = mount(EntryPage);

      const inputs = wrapper.findAll("input");
      await inputs[0].setValue("");
      await inputs[1].setValue("X");
      await wrapper.get("button").trigger("click");
      await nextTick();

      const feedback = wrapper.findAll(".feedback").map((x) => x.text());
      expect(feedback).toContain("Name required");
      expect(feedback).toContain("Invalid code");
      expect(pushSpy).not.toHaveBeenCalled();
   });

   it("shows generic message on unknown join errors", async () => {
      const consoleSpy = vi
         .spyOn(console, "error")
         .mockImplementation(() => {});
      socketHarness.emitWithAck.mockRejectedValueOnce(new Error("network"));
      const wrapper = mount(EntryPage);

      await wrapper.get("button").trigger("click");
      expect(messageErrorSpy).toHaveBeenCalledWith(
         "An unknown error occurred while joining the room.",
      );
      expect(pushSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
   });

   it("submits via Enter key and supports partial field error responses", async () => {
      socketHarness.emitWithAck
         .mockResolvedValueOnce({
            fieldErrors: {
               studentName: "Name required",
            },
         })
         .mockResolvedValueOnce({
            room: { code: "ABCD" },
            student: { name: "Kyle" },
         });
      const wrapper = mount(EntryPage);

      const inputs = wrapper.findAll("input");
      await inputs[0].setValue("");
      await inputs[1].setValue("ABCD");
      await wrapper.get("form").trigger("keydown", { key: "Enter" });
      await nextTick();

      const feedback = wrapper.findAll(".feedback").map((x) => x.text());
      expect(feedback).toContain("Name required");
      expect(feedback).not.toContain("Invalid code");

      await inputs[0].setValue("Kyle");
      await wrapper.get("form").trigger("keydown", { key: "Enter" });
      await nextTick();
      expect(pushSpy).toHaveBeenCalledWith({
         path: "/room/ABCD",
         query: { studentName: "Kyle" },
      });
   });

   it("updates loading state while join request is in-flight", async () => {
      let resolveAck: (value: any) => void = () => {};
      const pending = new Promise((resolve) => {
         resolveAck = resolve;
      });
      socketHarness.emitWithAck.mockReturnValueOnce(pending);

      const wrapper = mount(EntryPage);
      const button = wrapper.get("button");

      await button.trigger("click");
      await nextTick();
      expect(button.attributes("data-loading")).toBe("true");
      expect(
         wrapper
            .findAll("input")
            .every((x) => (x.element as HTMLInputElement).disabled),
      ).toBe(true);

      resolveAck({
         room: { code: "ABCD" },
         student: { name: "Kyle" },
      });
      await nextTick();
      await nextTick();

      expect(button.attributes("data-loading")).toBe("false");
   });
});
