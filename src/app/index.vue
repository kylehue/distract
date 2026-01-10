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
import { RouterView } from "vue-router";
const theme = ref<"light" | "dark">("dark");


function pyErrorHandler(data: any) {
   console.log("Python error:", data?.data);
}

window.api.on("py:error", pyErrorHandler);

onUnmounted(() => {
   window.api.off("py:error", pyErrorHandler);
});
</script>
