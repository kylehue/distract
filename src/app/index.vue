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
      <NText class="absolute right-2 bottom-1 text-xs pointer-events-none select-none opacity-25 font-mono">
         {{ __APP_VERSION__ }}
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
import { onUnmounted, ref } from "vue";
import { RouterView } from "vue-router";
const theme = ref<"light" | "dark">("dark");

const __APP_VERSION__ = (window as any).__APP_VERSION__;

function pyErrorHandler(data: any) {
   console.log("Python error:", data?.data);
}

window.api.on("py:error", pyErrorHandler);

onUnmounted(() => {
   window.api.off("py:error", pyErrorHandler);
});
</script>
