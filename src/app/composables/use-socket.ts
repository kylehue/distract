import { onUnmounted, computed, unref } from "vue";
import { keysToCamel } from "@/lib/object";
import { isConnected as _isConnected, socket } from "@/lib/socket";

export function useSocket() {
   const isConnected = computed(() => _isConnected.value);
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

   async function emitWithAck<TRes = any>(
      event: string,
      data: Record<any, any> = {},
      timeoutMs = 8000,
   ): Promise<TRes> {
      data["uuid"] = await window.api.getUuid();
      const payload = unref(data);

      if (process.env.NODE_ENV === "development") {
         console.log(`CLIENT -> SERVER (ACK ${event}):\n`, payload);
      }

      const res = await (await socket)
         .timeout(timeoutMs)
         .emitWithAck(event, payload);

      if (process.env.NODE_ENV === "development") {
         console.log(`SERVER ACK -> CLIENT (${event}):\n`, res);
      }

      return keysToCamel(res) as TRes;
   }

   return { socket, isConnected, on, emit, emitWithAck };
}
