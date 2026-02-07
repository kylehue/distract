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
      <NText
         class="absolute right-2 bottom-1 text-xs pointer-events-none select-none opacity-25 font-mono"
      >
         v{{ appVersion }}
      </NText>
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
   NText,
} from "naive-ui";
import { darkThemeOverrides, lightThemeOverrides } from "@/lib/theme-overrides";
import { onMounted, onUnmounted, ref } from "vue";
import { RouterView } from "vue-router";
import { useSocket } from "./composables/use-socket";
const theme = ref<"light" | "dark">("dark");
const socket = useSocket();

const appVersion = ref("");

function pyErrorHandler(data: any) {
   console.log("Python error:", data?.data);
}

window.api.on("py:error", pyErrorHandler);

socket.on("student:notification", async (data) => {
   const title = data.title as string;
   const message = data.message as string;
   window.api.showNotification({ title, body: message });
});

onMounted(async () => {
   appVersion.value = await window.api.getVersion();
});

onUnmounted(() => {
   window.api.off("py:error", pyErrorHandler);
});
</script>
