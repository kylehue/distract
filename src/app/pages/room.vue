<template>
   <div class="flex flex-col w-full h-full">
      <div class="flex">
         <div class="flex flex-col">
            <NText class="text-xs" depth="3">Host</NText>
            <NText>Ms. Alice Bobbystone</NText>
         </div>
      </div>
      <div class="flex flex-1 items-center justify-center">
         <NText class="text-lg" :type="isBeingMonitored ? 'error' : 'default'">
            {{
               isBeingMonitored
                  ? "You are currently being monitored."
                  : "The teacher hasn't started monitoring yet."
            }}
         </NText>
      </div>
      <div class="flex flex-wrap">
         <NText>{{ monitorData }}</NText>
      </div>
      <div class="flex justify-end">
         <NButton
            @click="router.push('/')"
            type="error"
            secondary
            :disabled="isBeingMonitored"
         >
            Leave room
         </NButton>
      </div>
   </div>
</template>

<script setup lang="ts">
import "vfonts/Inter.css";
import { NButton, NStatistic, NText } from "naive-ui";
import { onBeforeUnmount, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
const router = useRouter();
const isBeingMonitored = ref(false);
const monitorData = ref("");

(window as any).isBeingMonitored = isBeingMonitored;

onMounted(() => {
   const listener = (data: any) => {
      monitorData.value =
         "yaw: " +
         data.yaw.toFixed(2) +
         ", pitch: " +
         data.pitch.toFixed(2) +
         ", roll: " +
         data.roll.toFixed(2);
      isBeingMonitored.value = true;
   };

   window.api.on("py:monitoring_data", listener);

   onBeforeUnmount(() => {
      window.api.off("py:monitoring_data", listener);
   });
});
</script>
