<template>
   <NButton
      circle
      quaternary
      @click="theme = theme === 'dark' ? 'light' : 'dark'"
   >
      <template #icon>
         <PhMoon v-if="theme === 'dark'" />
         <PhSunDim v-else />
      </template>
   </NButton>
</template>

<script setup lang="ts">
import { NButton } from "naive-ui";
import { inject, computed } from "vue";
import { THEME_INJECTION_KEY } from "@/lib/injection-keys";
import { PhMoon, PhSunDim } from "@phosphor-icons/vue";
const theme = inject(THEME_INJECTION_KEY)!;
</script>
