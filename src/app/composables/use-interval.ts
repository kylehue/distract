import { onMounted, onUnmounted } from "vue";

export function useInterval(fn: () => void, interval: number) {
   let timer: ReturnType<typeof setInterval> | null = null;

   onMounted(() => {
      timer = setInterval(fn, interval);
   });

   onUnmounted(() => {
      if (timer) {
         clearInterval(timer);
      }
   });
}
