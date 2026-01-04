<template>
   <div
      v-if="isJoinRoomLoading"
      class="flex items-center justify-center w-full h-full"
   >
      <div class="flex items-center gap-2">
         <NSpin />
         <NText>Loading...</NText>
      </div>
   </div>
   <template v-else-if="!roomInfo">Room not found</template>
   <div v-else class="flex flex-col w-full h-full">
      <div class="flex">
         <div class="flex flex-col">
            <NText class="text-xs" depth="3">Host</NText>
            <NText>{{ roomInfo.teacherId }}</NText>
         </div>
      </div>
      <div class="flex flex-1 items-center justify-center">
         <NText
            class="text-lg"
            :type="roomInfo.status === 'monitoring' ? 'error' : 'default'"
         >
            {{
               roomInfo.status === "monitoring"
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
            @click="leaveRoom()"
            type="error"
            secondary
            :disabled="roomInfo.status === 'monitoring'"
            :loading="isLeaveRoomLoading"
         >
            Leave room
         </NButton>
      </div>
   </div>
</template>

<script setup lang="ts">
import { NButton, NSpin, NText, useMessage } from "naive-ui";
import { onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useSocket } from "@/app/composables/use-socket";
import { useSocketEvent } from "../composables/use-socket-event";
import { RoomInfo } from "@/lib/typings";

const router = useRouter();
const route = useRoute();
const socket = useSocket();
const message = useMessage();
const monitorData = ref("");
const roomInfo = ref<RoomInfo>();

const { execute: joinRoom, isLoading: isJoinRoomLoading } = useSocketEvent({
   executeEvent: "student:join_room",
   successEvent: "student:join_room_success",
   errorEvent: "student:join_room_error",
   executeImmediately: true,
   executePayload: () => ({
      roomCode: route.params.roomCode,
      studentName: route.query.studentName,
   }),
   onSuccess(data) {
      roomInfo.value = data.room;
   },
   onError(errorData) {
      router.push("/");
      message.error(
         errorData.message || "Failed to join the room. Please try again."
      );
   },
});

const { execute: leaveRoom, isLoading: isLeaveRoomLoading } = useSocketEvent({
   successEvent: "student:leave_room_success",
   executeEvent: "student:leave_room",
   onSuccess() {
      window.api.invoke("stop_monitoring", {});
      router.push("/");
   },
});

// on reconnect
socket.on("connect", () => {
   console.log("Rejoining room...");
   joinRoom();
});

socket.on("student:update_room", (data) => {
   roomInfo.value = data.room as RoomInfo;
});

watch(
   roomInfo,
   (newVal) => {
      if (newVal && newVal.status === "monitoring") {
         window.api.invoke("start_monitoring", {});
      } else {
         window.api.invoke("stop_monitoring", {});
      }
   },
   { immediate: true }
);
</script>
