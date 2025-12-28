import { createApp } from "vue";
import "@/styles/global.css";
import App from "@/app/index.vue";
import { router } from "@/lib/router";
import SocketPlugin, { getSocket } from "@/plugins/socket";
import { getUserId } from "./lib/user-id";
import { useStore } from "./app/composables/use-store";

const app = createApp(App);

app.use(router);
app.use(SocketPlugin);

// mount
app.mount("#app").$nextTick(() => {
   // Use contextBridge
   window.ipcRenderer.on("main-process-message", (_event, message) => {
      console.log(message);
   });
});

// listen for monitoring data from Python client
const socket = getSocket();
const store = useStore();
window.api.on("py:monitoring_data", (data) => {
   let userId = getUserId();
   let roomCode = store.roomCode.value;
   if (!roomCode) {
      console.warn("No room found; cannot send monitoring data");
      return;
   }

   let samples = data.data as number[][];
   console.log("Received monitoring data:", samples);
   socket.emit("student:monitoring_data", {
      userId: userId,
      roomCode: roomCode,
      monitoringData: samples,
   });
});
