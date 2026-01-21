<template>
   <div
      v-if="postJoinRoom.isLoading"
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
            :loading="patchLeaveRoom.isLoading"
         >
            Leave room
         </NButton>
      </div>
   </div>
</template>

<script setup lang="ts">
import { NButton, NSpin, NText, useMessage } from "naive-ui";
import { onMounted, onUnmounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useSocket } from "@/app/composables/use-socket";
import { RoomInfo, StudentInfo } from "@/lib/typings";
import { useFetch } from "../composables/use-fetch";
import { useVideoRecorder } from "../composables/use-video-recorder";
import {
   MONITOR_LOG_INTERVAL_MILLIS,
   MONITOR_LOG_NUMBER_OF_SAMPLES,
} from "@/lib/constants";
import { compressVideoBlob, videoBlobToBase64Frames } from "@/lib/blob";

const router = useRouter();
const route = useRoute();
const socket = useSocket();
const message = useMessage();
const roomInfo = ref<RoomInfo>();
const videoRecorder = useVideoRecorder({
   chunkMillis: MONITOR_LOG_INTERVAL_MILLIS,
});
const postMonitorLogRecording = useFetch(
   "/api/monitor_logs/upload_recording",
   "POST"
);

const postJoinRoom = useFetch<{
   room: RoomInfo;
   student: StudentInfo;
   teacher: any;
}>("/api/join_room", "POST");

const patchLeaveRoom = useFetch("/api/leave_room", "PATCH");

async function joinRoom() {
   try {
      const { data } = await postJoinRoom.execute({
         body: {
            roomCode: route.params.roomCode,
            studentName: route.query.studentName,
         },
      });

      roomInfo.value = data!.room;
   } catch {
      router.push("/");
      message.error(
         postJoinRoom.error?.message ||
            "Failed to join the room. Please try again."
      );
   }
}

async function leaveRoom() {
   try {
      await patchLeaveRoom.execute();
      router.push("/");
   } catch {
      message.error(
         patchLeaveRoom.error?.message ||
            "Failed to leave the room. Please try again."
      );
   }
}

const recordingMap = new Map<string, Promise<Blob>>();
videoRecorder.onChunk(async (recording) => {
   let roomCode = route.params.roomCode;
   if (!roomCode) {
      console.warn("No room found; cannot send monitoring data");
      return;
   }

   let transactionId = crypto.randomUUID();

   // send as promise because we don't know when the recording follow-up will be requested
   // we don't want to await here because that will degrade real-time performance
   recordingMap.set(transactionId, compressVideoBlob(recording));

   let frames = await videoBlobToBase64Frames(
      recording, // use uncompressed
      MONITOR_LOG_NUMBER_OF_SAMPLES
   );

   let samples = await window.api.invoke("extract_features", { frames });

   socket.emit("student:post_monitor_logs", {
      transactionId: transactionId,
      roomCode: roomCode,
      samples: JSON.stringify(samples),
   });
});

// video follow-up
socket.on("student:post_monitor_logs_success", async (data) => {
   let monitorLogId = data.monitorLogId;
   let transactionId = data.transactionId;

   let recordingPromise = recordingMap.get(transactionId);
   if (!recordingPromise) {
      console.warn("No video found for transaction ID:", transactionId);
      return;
   }

   let recording = await recordingPromise;

   let body = new FormData();
   body.append("recording", recording);
   body.append("monitorLogId", monitorLogId);
   await postMonitorLogRecording.execute({
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

socket.on("student:pause_monitoring", async (data) => {
   const room = data.room as RoomInfo;
   roomInfo.value = room;
   videoRecorder.stop();
});

socket.on("student:stop_monitoring", async (data) => {
   const room = data.room as RoomInfo;
   roomInfo.value = room;
   videoRecorder.stop();
});

onMounted(() => {
   joinRoom();
});

onUnmounted(() => {
   videoRecorder.stop();
   leaveRoom();
});
</script>
