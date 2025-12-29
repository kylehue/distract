<template>
   <div class="flex flex-col w-full h-full">
      <div class="flex">
         <div class="flex flex-col">
            <NText class="text-xs" depth="3">Host</NText>
            <NText>{{ store.hostName }}</NText>
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
            @click="leaveRoom"
            type="error"
            secondary
            :disabled="isBeingMonitored"
            :loading="isLeaveRoomLoading"
         >
            Leave room
         </NButton>
      </div>
   </div>
</template>

<script setup lang="ts">
import { NButton, NText } from "naive-ui";
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useSocket } from "@/app/composables/use-socket";
import { useStore } from "@/app/composables/use-store";

const router = useRouter();
const socket = useSocket();
const store = useStore();
const monitorData = ref("");
const isBeingMonitored = ref(false);
const isLeaveRoomLoading = ref(false);

socket.on("student:start_monitoring", () => {
   window.api.invoke("start_monitoring", {});
   isBeingMonitored.value = true;
});

socket.on("student:stop_monitoring", () => {
   window.api.invoke("stop_monitoring", {});
   isBeingMonitored.value = false;
});

function leaveRoom() {
   isLeaveRoomLoading.value = true;
   socket.emit("student:leave_room", {});
}

socket.on("student:leave_room_success", () => {
   isLeaveRoomLoading.value = false;
   isBeingMonitored.value = false;
   window.api.invoke("stop_monitoring", {});
   store.clearRoom();
   router.push("/");
});

// watch(
//    isBeingMonitored,
//    (newVal) => {
//       console.log("monitoring:", newVal);

//       if (newVal) {
//          window.api.invoke("start_monitoring", {});
//       } else {
//          window.api.invoke("stop_monitoring", {});
//       }
//    },
//    { immediate: true }
// );

// onMounted(() => {
//    console.log(34);
//    const listener = (data: any) => {
//       console.log("data:", data);
//    };

//    window.api.on("py:monitoring_data", listener);

//    onBeforeUnmount(() => {
//       window.api.off("py:monitoring_data", listener);
//    });
// });
</script>
