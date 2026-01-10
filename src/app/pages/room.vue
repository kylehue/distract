<template>
   <div
      v-if="fetchJoinRoom.isLoading"
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
      <div class="flex justify-end">
         <NButton
            @click="leaveRoom()"
            type="error"
            secondary
            :disabled="roomInfo.status === 'monitoring'"
            :loading="fetchLeaveRoom.isLoading"
         >
            Leave room
         </NButton>
      </div>
   </div>
</template>

<script setup lang="ts">
import { NButton, NSpin, NText, useMessage } from "naive-ui";
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useSocket } from "@/app/composables/use-socket";
import { RoomInfo, RoomStudentInfo } from "@/lib/typings";
import { useFetch } from "../composables/use-fetch";
import { useVideoRecorder } from "../composables/use-video-recorder";
import {
   MONITOR_LOG_INTERVAL_MILLIS,
   MONITOR_LOG_NUMBER_OF_SAMPLES,
} from "@/lib/constants";
import { videoBlobToBase64Frames } from "@/lib/blob";

const router = useRouter();
const route = useRoute();
const socket = useSocket();
const message = useMessage();
const roomInfo = ref<RoomInfo>();
const videoRecorder = useVideoRecorder({
   chunkMillis: MONITOR_LOG_INTERVAL_MILLIS,
});
const fetchMonitorLogs = useFetch("/api/monitor_logs", "POST");

const fetchJoinRoom = useFetch<{
   room: RoomInfo;
   student: RoomStudentInfo;
   teacher: any;
}>("/api/join_room", "POST");

const fetchLeaveRoom = useFetch("/api/leave_room", "PATCH");

async function joinRoom() {
   try {
      const { data } = await fetchJoinRoom.execute({
         body: {
            roomCode: route.params.roomCode,
            studentName: route.query.studentName,
         },
      });

      roomInfo.value = data!.room;
   } catch {
      router.push("/");
      message.error(
         fetchJoinRoom.error?.message ||
            "Failed to join the room. Please try again."
      );
   }
}

async function leaveRoom() {
   try {
      await fetchLeaveRoom.execute();
      router.push("/");
   } catch {
      message.error(
         fetchLeaveRoom.error?.message ||
            "Failed to leave the room. Please try again."
      );
   }
}

videoRecorder.onChunk(async (chunk) => {
   let roomCode = route.params.roomCode;
   if (!roomCode) {
      console.warn("No room found; cannot send monitoring data");
      return;
   }

   const frames = await videoBlobToBase64Frames(
      chunk,
      MONITOR_LOG_NUMBER_OF_SAMPLES
   );
   const samples = await window.api.invoke("extract_features", { frames });
   let body = new FormData();
   body.append("roomCode", roomCode as string);
   body.append("samples", JSON.stringify(samples));
   body.append("video", chunk);

   await fetchMonitorLogs.execute({
      body: body,
   });
});

// on reconnect
socket.on("connect", () => {
   console.log("Rejoining room...");
   joinRoom();
});

socket.on("student:start_monitoring", async (data) => {
   const room = data.room as RoomInfo;
   roomInfo.value = room;
   videoRecorder.start();
});

socket.on("student:stop_monitoring", async (data) => {
   const room = data.room as RoomInfo;
   roomInfo.value = room;
   videoRecorder.stop();
});

onMounted(() => {
   joinRoom();
});
</script>
