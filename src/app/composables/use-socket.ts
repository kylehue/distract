import { onUnmounted, ref, unref } from "vue";
import { keysToCamel } from "@/lib/object";
import { socket } from "@/lib/socket";

export function useSocket() {
   async function on(
      event: string,
      handler: (data: Record<any, any>) => void,
      { autoClean = true } = {},
   ) {
      const wrappedHandler = (data: any) => handler(keysToCamel(data));
      if (autoClean) {
         onUnmounted(async () => (await socket).off(event, wrappedHandler));
      }

      // dev logging
      if (process.env.NODE_ENV === "development") {
         const debugHandler = (args: any) => {
            console.log(`SERVER -> CLIENT (${event}):\n`, args);
         };
         if (autoClean) {
            onUnmounted(async () => (await socket).off(event, debugHandler));
         }

         (await socket).on(event, debugHandler);
      }

      (await socket).on(event, wrappedHandler);
   }

   async function emit(event: string, data: Record<any, any> = {}) {
      data["uuid"] = await window.api.getUuid(); // attach uuid
      (await socket).emit(event, unref(data));

      // dev logging
      if (process.env.NODE_ENV === "development") {
         console.log(`CLIENT -> SERVER (${event}):\n`, unref(data));
      }
   }

   return { socket, on, emit };
}
