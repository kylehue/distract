<template>
   <div class="flex items-center justify-center w-full h-full">
      <div class="flex flex-col gap-2">
         <NInput placeholder="Student name">
            <template #prefix>
               <PhUser />
            </template>
         </NInput>
         <NInput placeholder="Room code">
            <template #prefix>
               <PhHouseSimple />
            </template>
         </NInput>
         <NButton @click="router.push('/room')">Join room</NButton>
      </div>
   </div>
</template>

<script setup lang="ts">
import "vfonts/Inter.css";
import { NButton, NInput } from "naive-ui";
import { PhHouseSimple, PhUser } from "@phosphor-icons/vue";
import { useRouter } from "vue-router";
const router = useRouter();
</script>
