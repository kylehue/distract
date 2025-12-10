import { onBeforeUnmount } from "vue";
import { getSocket } from "@/plugins/socket";

export function useSocket() {
   const socket = getSocket();

   function on(event: string, handler: (...args: any[]) => void) {
      socket.on(event, handler);
      // auto-clean on component unmount
      onBeforeUnmount(() => socket.off(event, handler));
   }

   function emit(event: string, ...data: any[]) {
      socket.emit(event, ...data);
   }

   return { socket, on, emit };
}
