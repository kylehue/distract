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
import { useFetch } from "./composables/use-fetch";
const theme = ref<"light" | "dark">("dark");
const route = useRoute();
const fetch = useFetch("/api/monitor_logs", "POST");

// listen for monitoring data from Python client
async function monitorDataHandler(data: any) {
   let roomCode = route.params.roomCode;
   if (!roomCode) {
      console.warn("No room found; cannot send monitoring data");
      return;
   }

   try {
      let samples = data.data as number[][];
      let body = new FormData();
      body.append("roomCode", roomCode as string);
      body.append("samples", JSON.stringify(samples));
      // TODO: add video
      await fetch.execute({
         body: body,
      });
      console.log("Sent monitoring data to server");
   } catch (e) {
      console.error("Failed to send monitoring data:", e);
   }
}

window.api.on("py:monitoring_data", monitorDataHandler);

onUnmounted(() => {
   window.api.off("py:monitoring_data", monitorDataHandler);
});
</script>
