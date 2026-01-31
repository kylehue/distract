import { io, Socket } from "socket.io-client";
import type { App } from "vue";

let socket: Socket = io(import.meta.env.VITE_API_URL, {
   autoConnect: true,
});

export default {
   install(app: App) {
      socket.on("connect", () => {
         console.log("Socket connected:", socket.id);
      });

      socket.on("disconnect", (reason) => {
         console.log("Socket disconnected:", reason);
      });

      // expose it globally
      app.config.globalProperties.$socket = socket;
      (window as any).$socket = socket;
   },
};

// Export for composables
export function getSocket(): Socket {
   return socket;
}
