import { createApp } from "vue";
import "@/styles/global.css";
import App from "@/app/index.vue";
import { router } from "@/lib/router";
import SocketPlugin, { getSocket } from "@/plugins/socket";
import { getUuid } from "./lib/uuid";
import { useRoute } from "vue-router";

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
