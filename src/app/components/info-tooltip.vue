<template>
   <NTooltip>
      <template #trigger>
         <NText :depth="3" class="text-lg cursor-help">ⓘ</NText>
      </template>
      <div class="max-w-[500px]">
         <slot></slot>
      </div>
   </NTooltip>
</template>

<script setup lang="ts">
import { NTooltip, NText, useThemeVars } from "naive-ui";

const themeVars = useThemeVars();
</script>
