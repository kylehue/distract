<template>
   <NConfigProvider
      class="h-full"
      :theme="theme === 'light' ? lightTheme : darkTheme"
      :theme-overrides="
         theme === 'light' ? lightThemeOverrides : darkThemeOverrides
      "
   >
      <RouterView></RouterView>
      <NGlobalStyle></NGlobalStyle>
   </NConfigProvider>
</template>

<script setup lang="ts">
import "vfonts/Inter.css";
import { NConfigProvider, NGlobalStyle, lightTheme, darkTheme } from "naive-ui";
import { darkThemeOverrides, lightThemeOverrides } from "@/lib/theme-overrides";
import { ref } from "vue";
import { RouterView } from "vue-router";
const theme = ref<"light" | "dark">("dark");
</script>
