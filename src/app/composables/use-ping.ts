import { ref, onUnmounted } from "vue";
import { useSocket } from "./use-socket";

export function usePing() {
   const latency = ref(0);
   const socket = useSocket();
   const minIntervalMillis = 3000; // minimum time between pings to avoid spamming
   const maxLatency = 9999; // max latency to wait for before considering the ping failed

   let stopped = false;
   let timer: number | null = null;

   const pingLoop = async () => {
      if (stopped) return;

      const start = Date.now();

      try {
         await socket.emitWithAck("ping", {}, maxLatency);
         latency.value = Date.now() - start;
      } catch {
         latency.value = maxLatency;
      }

      // interval
      const elapsed = Date.now() - start;
      const delay = Math.max(minIntervalMillis - elapsed, 0);

      timer = window.setTimeout(pingLoop, delay);
   };

   // start immediately
   pingLoop();

   onUnmounted(() => {
      stopped = true;
      if (timer) clearTimeout(timer);
   });

   return { latency };
}
