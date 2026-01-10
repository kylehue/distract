import { onUnmounted, ref, unref } from "vue";
import { getSocket } from "@/plugins/socket";
import { getUuid } from "@/lib/uuid";
import { keysToCamel } from "@/lib/object";

export function useSocket() {
   const socket = getSocket();

   function on(
      event: string,
      handler: (data: Record<any, any>) => void,
      { autoClean = true } = {}
   ) {
      socket.on(event, (data) => handler(keysToCamel(data)));
      if (autoClean) {
         onUnmounted(() => socket.off(event, handler));
      }

      // dev logging
      if (process.env.NODE_ENV === "development") {
         const _test_handler_ = (args: any) => {
            console.log(`SERVER -> CLIENT (${event}):\n`, args);
         };
         socket.on(event, _test_handler_);
         if (autoClean) {
            onUnmounted(() => socket.off(event, _test_handler_));
         }
      }
   }

   async function emit(event: string, data: Record<any, any> = {}) {
      data["uuid"] = await getUuid(); // attach uuid
      socket.emit(event, unref(data));

      // dev logging
      if (process.env.NODE_ENV === "development") {
         console.log(`CLIENT -> SERVER (${event}):\n`, unref(data));
      }
   }

   return { socket, on, emit };
}
