<template>
   <NConfigProvider
      class="h-full"
      :theme="theme === 'light' ? lightTheme : darkTheme"
      :theme-overrides="
         theme === 'light' ? lightThemeOverrides : darkThemeOverrides
      "
   >
      <div class="flex flex-col gap-4 p-4 h-full">
         <NText>Add with Python</NText>
         <div class="flex flex-col gap-4 items-center">
            <NInputNumber v-model:value="a" placeholder="First number" />
            <NInputNumber v-model:value="b" placeholder="Second number" />
            <NButton @click="doAdd">Add</NButton>
         </div>
         <p>Result: {{ result }}</p>
      </div>
      <NGlobalStyle></NGlobalStyle>
   </NConfigProvider>
</template>

<script setup lang="ts">
import "vfonts/Inter.css";
import {
   NConfigProvider,
   NGlobalStyle,
   lightTheme,
   darkTheme,
   NButton,
   NInput,
   NInputNumber,
   NText,
} from "naive-ui";
import { darkThemeOverrides, lightThemeOverrides } from "@/lib/theme-overrides";
import { ref } from "vue";
const theme = ref<"light" | "dark">("dark");

const a = ref<number | null>(2);
const b = ref<number | null>(5);
const result = ref<string>("—");

async function doAdd() {
   console.log(a.value, b.value);

   try {
      const x = a.value ?? 0;
      const y = b.value ?? 0;
      const sum = await window.api.add(x, y);
      result.value = String(sum);
   } catch (e: any) {
      result.value = `Error: ${e?.message ?? e}`;
   }
}
</script>
