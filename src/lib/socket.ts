import { io, Socket } from "socket.io-client";

export const socket = new Promise<Socket>(async (resolve) => {
   let socket = io(import.meta.env.VITE_API_URL, {
      autoConnect: true,
      auth: {
         "API-KEY": await window.api.getApiKey(),
      },
   });

   socket.on("connect", () => {
      console.log("Socket connected:", socket.id);
   });

   socket.on("disconnect", (reason) => {
      console.log("Socket disconnected:", reason);
   });

   resolve(socket);
});
