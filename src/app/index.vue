<template>
   <NConfigProvider
      class="h-full"
      :theme="theme === 'light' ? lightTheme : darkTheme"
      :theme-overrides="
         theme === 'light' ? lightThemeOverrides : darkThemeOverrides
      "
   >
      <NMessageProvider placement="bottom-left" closable keep-alive-on-hover>
         <RouterView></RouterView>
      </NMessageProvider>
      <NGlobalStyle></NGlobalStyle>
   </NConfigProvider>
</template>

<script setup lang="ts">
import "vfonts/Inter.css";
import {
   NConfigProvider,
   NGlobalStyle,
   NMessageProvider,
   lightTheme,
   darkTheme,
} from "naive-ui";
import { darkThemeOverrides, lightThemeOverrides } from "@/lib/theme-overrides";
import { onUnmounted, ref } from "vue";
import { RouterView, useRoute, useRouter } from "vue-router";
import { useSocket } from "./composables/use-socket";
const theme = ref<"light" | "dark">("dark");
const socket = useSocket();
const route = useRoute();

// listen for monitoring data from Python client
async function monitorDataHandler(data: any) {
   let roomCode = route.params.roomCode;
   if (!roomCode) {
      console.warn("No room found; cannot send monitoring data");
      return;
   }

   let samples = data.data as number[][];
   console.log("Received monitoring data:", samples);
   socket.emit("student:monitoring_data", {
      roomCode: roomCode,
      samples: samples,
   });
}

window.api.on("py:monitoring_data", monitorDataHandler);

onUnmounted(() => {
   window.api.off("py:monitoring_data", monitorDataHandler);
});
</script>
