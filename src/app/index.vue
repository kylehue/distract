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
import { onUnmounted, ref, provide, watchEffect, onMounted } from "vue";
import { RouterView } from "vue-router";
import { useSocket } from "./composables/use-socket";
import { THEME_INJECTION_KEY } from "@/lib/injection-keys";
const theme = ref<"light" | "dark">("dark");
const socket = useSocket();

function pyErrorHandler(data: any) {
   console.log("Python error:", data?.data);
}

window.api.on("py:error", pyErrorHandler);

socket.on("student:notification", async (data) => {
   const title = data.title as string;
   const message = data.message as string;
   window.api.showNotification({ title, body: message });
});

onUnmounted(() => {
   window.api.off("py:error", pyErrorHandler);
});

// initial theme setup
onMounted(async () => {
   theme.value = await window.api.setTheme(
      localStorage.getItem("theme") === "dark" ? "dark" : "light",
   );
});

// theme change watcher
watchEffect(() => {
   if (theme.value === "dark") {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
      window.api.setTheme("dark");
   } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
      window.api.setTheme("light");
   }
});

provide(THEME_INJECTION_KEY, theme);
</script>
