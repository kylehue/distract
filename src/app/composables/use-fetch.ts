import { keysToCamel } from "@/lib/object";
import { getUuid } from "@/lib/uuid";
import { getSocket } from "@/plugins/socket";
import { proxyRefs, ref } from "vue";

export type ApiSuccess<T> = {
   message: string;
   data?: T;
};

export type ApiError = {
   message: string;
   fieldErrors?: Record<string, string>;
};

function resolveUrl(
   template: string,
   params?: Record<string, string | number>
) {
   if (!params) return template;

   let url = template;

   for (const [key, value] of Object.entries(params)) {
      url = url.replace(
         new RegExp(`:${key}\\b`, "g"),
         encodeURIComponent(String(value))
      );
   }

   // dev safety: unresolved params
   if (process.env.NODE_ENV === "development") {
      const unresolved = url.match(/:[a-zA-Z_]\w*/g);
      if (unresolved) {
         throw new Error(
            `Unresolved URL params: ${unresolved.join(", ")} in ${template}`
         );
      }
   }

   return url;
}

async function waitForSocket() {
   const socket = getSocket();
   if (socket.connected) return socket;
   return new Promise<typeof socket>((resolve) => {
      socket.once("connect", () => resolve(socket));
   });
}

export function useFetch<T = any>(url: string, method: string = "GET") {
   const data = ref<ApiSuccess<T> | null>(null);
   const error = ref<ApiError | null>(null);
   const isLoading = ref(false);

   type ExecuteOptions = Omit<RequestInit, "body" | "method"> & {
      body?: Record<string, any> | FormData | null;
      params?: Record<string, any>;
   };

   const execute = async (
      options: ExecuteOptions = {}
   ): Promise<ApiSuccess<T>> => {
      isLoading.value = true;
      data.value = null;
      error.value = null;

      if (process.env.NODE_ENV === "development") {
         console.log(`FETCH -> ${url}:\n`, options);
      }

      try {
         // wait for socket to be ready
         const socket = await waitForSocket();
         const sid = socket.id;
         const uuid = await getUuid();

         const headers: HeadersInit = {
            ...options.headers,
            // attach uuid and sid
            "X-UUID": uuid,
            "X-SID": sid ?? "",
         };

         let body: BodyInit | undefined;

         if (options.body instanceof FormData) {
            body = options.body;
         } else if (options.body) {
            (headers as any)["Content-Type"] = "application/json";
            body = JSON.stringify(options.body);
         }

         const res = await fetch(resolveUrl(url, options.params), {
            ...options,
            headers,
            body,
            method,
            credentials: "include",
         });

         const json = keysToCamel(await res.json());

         if (!res.ok) {
            // server-controlled error shape
            const apiError: ApiError = {
               message: json?.message ?? "Request failed",
               fieldErrors: json?.fieldErrors,
            };
            throw apiError;
         }

         data.value = json;
         return json;
      } catch (err: any) {
         error.value = {
            message: err?.message ?? "Unknown error",
            fieldErrors: err?.fieldErrors,
         };
         throw err;
      } finally {
         isLoading.value = false;

         if (process.env.NODE_ENV === "development") {
            console.log(`RESPONSE -> ${url}:\n`, data.value || error.value);
         }
      }
   };

   return proxyRefs({
      data,
      error,
      isLoading,
      execute,
   });
}
