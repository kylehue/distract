import { createApp } from "vue";
import "./styles/global.css";
import App from "./app/index.vue";

const app = createApp(App);

// mount
app.mount("#app").$nextTick(() => {
   // Use contextBridge
   window.ipcRenderer.on("main-process-message", (_event, message) => {
      console.log(message);
   });
});
