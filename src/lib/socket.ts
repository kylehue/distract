import { io, Socket } from "socket.io-client";
import { ref } from "vue";

export const isConnected = ref(false);

export const socket = new Promise<Socket>(async (resolve) => {
   let socket = io(import.meta.env.VITE_API_URL, {
      autoConnect: true,
      transports: ["websocket", "polling", "webtransport"],
      auth: {
         API_KEY: await window.api.getApiKey(),
         UUID: await window.api.getUuid(),
      },
   });

   socket.on("connect", () => {
      console.log("Socket connected:", socket.id);
      isConnected.value = true;
   });

   socket.on("disconnect", (reason) => {
      console.log("Socket disconnected:", reason);
      isConnected.value = false;
   });

   (window as any).$socket = socket;

   resolve(socket);
});
