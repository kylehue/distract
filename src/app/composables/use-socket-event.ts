import { ref } from "vue";
import { useSocket } from "./use-socket";

interface UseSocketEventOptions<T = any, E = any> {
   successEvent: string;
   errorEvent?: string;
   executeEvent: string;
   executePayload?: Record<any, any> | (() => Record<any, any>);
   executeImmediately?: boolean;
   onSuccess?: (data: T) => void;
   onError?: (errorData: E) => void;
   onBeforeExecute?: (payload?: any) => boolean;
}

export function useSocketEvent<T = any, E = any>(
   options: UseSocketEventOptions<T, E>
) {
   const { on, emit } = useSocket();
   const data = ref<T | null>(null);
   const errorData = ref<E | null>(null);
   const isLoading = ref(false);

   let resolvePromise: ((value: T) => void) | null = null;
   let rejectPromise: ((reason?: E) => void) | null = null;

   const getPayload = () => {
      if (typeof options.executePayload === "function") {
         return options.executePayload();
      }
      return options.executePayload;
   };

   const execute = (payload?: any): Promise<T> => {
      if (typeof options.onBeforeExecute === "function") {
         const shouldProceed = options.onBeforeExecute(payload);
         if (!shouldProceed) {
            return Promise.reject("Execution aborted");
         }
      }

      isLoading.value = true;
      data.value = null;
      errorData.value = null;

      return new Promise<T>((resolve, reject) => {
         resolvePromise = resolve;
         rejectPromise = reject;

         emit(options.executeEvent, payload ?? getPayload());
      });
   };

   // success handler
   on(options.successEvent, (payload: T) => {
      isLoading.value = false;
      data.value = payload;

      options.onSuccess?.(payload);
      resolvePromise?.(payload);
      resolvePromise = null;
      rejectPromise = null;
   });

   // error handler (optional)
   if (options.errorEvent) {
      on(options.errorEvent, (payload: E) => {
         isLoading.value = false;
         errorData.value = payload;

         options.onError?.(payload);
         rejectPromise?.(payload);
         resolvePromise = null;
         rejectPromise = null;
      });
   }

   // execute immediately if requested
   if (options.executeImmediately) {
      execute(getPayload());
   }

   return { execute, data, errorData, isLoading };
}
