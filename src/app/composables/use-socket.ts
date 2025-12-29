import { onBeforeUnmount, ref, unref } from "vue";
import { getSocket } from "@/plugins/socket";
import { getUuid } from "@/lib/uuid";

export function useSocket() {
   const socket = getSocket();

   function on(event: string, handler: (args: Record<any, any>) => void) {
      socket.on(event, handler);
      // auto-clean on component unmount
      onBeforeUnmount(() => socket.off(event, handler));

      // dev logging
      if (process.env.NODE_ENV === "development") {
         const _test_handler_ = (args: any) => {
            console.log(`SERVER -> CLIENT (${event}):\n`, args);
         };
         socket.on(event, _test_handler_);
         onBeforeUnmount(() => socket.off(event, _test_handler_));
      }
   }

   async function emit(event: string, data: Record<any, any> = {}) {
      data["uuid"] = await getUuid();
      socket.emit(event, data);

      // dev logging
      if (process.env.NODE_ENV === "development") {
         console.log(`CLIENT -> SERVER (${event}):\n`, unref(data));
      }
   }

   return { socket, on, emit };
}
