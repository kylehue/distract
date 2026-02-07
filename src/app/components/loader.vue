<template>
   <div class="flex flex-col items-center gap-2">
      <img src="/distract-animated.svg" :width="props.size || 48" />
      <NText class="font-medium" italic>{{ props.text ?? "Loading..." }}</NText>
   </div>
</template>

<script setup lang="ts">
import { NText } from "naive-ui";

const props = defineProps<{
   size?: number;
   text?: string;
}>();
</script>
