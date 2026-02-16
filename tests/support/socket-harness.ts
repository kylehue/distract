import { ref } from "vue";
import { vi } from "vitest";

type Handler = (payload?: any) => void | Promise<void>;

export function createSocketHarness() {
   const handlers = new Map<string, Handler[]>();

   const on = vi.fn((event: string, handler: Handler) => {
      const existing = handlers.get(event) ?? [];
      existing.push(handler);
      handlers.set(event, existing);
   });

   const emit = vi.fn();
   const emitWithAck = vi.fn();

   async function trigger(event: string, payload?: any) {
      const listeners = handlers.get(event) ?? [];
      for (const handler of listeners) {
         await handler(payload);
      }
   }

   function reset() {
      handlers.clear();
   }

   return {
      socketApi: {
         socket: Promise.resolve({}),
         isConnected: ref(true),
         on,
         emit,
         emitWithAck,
      },
      on,
      emit,
      emitWithAck,
      trigger,
      reset,
   };
}
