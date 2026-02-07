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
   <template v-else-if="!room || !teacher || !student"> Missing data </template>
   <div v-else class="flex flex-col w-full h-full">
      <NText
         class="absolute left-2 bottom-1 text-xs pointer-events-none select-none opacity-25 font-mono"
      >
         {{ ping.latency }} ms
      </NText>
      <div class="flex justify-between items-center">
         <div class="flex flex-col">
            <NText class="text-xs" depth="3">Host</NText>
            <NText>{{ teacher.displayName }}</NText>
         </div>
         <div class="flex flex-col">
            <NText class="text-xs" depth="3">Room</NText>
            <NText>{{ room.title }}</NText>
         </div>
      </div>
      <div class="flex flex-1 items-center justify-center">
         <NText v-if="student.lockMonitorLogId" class="text-lg" type="error">
            Your system has been locked due to suspicious behavior.
         </NText>
         <NText v-else-if="!student.permitted" class="text-lg" type="warning">
            Your join request is pending approval from the teacher.
         </NText>
         <NText
            v-else
            class="text-lg"
            :type="room.status === 'monitoring' ? 'error' : 'default'"
         >
            {{
               room.status === "monitoring"
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
            :disabled="
               room.status === 'monitoring' || !!student?.lockMonitorLogId
            "
            :loading="isLeaveRoomLoading"
         >
            Leave room
         </NButton>
      </div>
   </div>
</template>

<script setup lang="ts">
import { NButton, NSpin, NText, useMessage } from "naive-ui";
import { onMounted, onBeforeUnmount, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useSocket } from "@/app/composables/use-socket";
import type { RoomInfo, StudentInfo, TeacherInfo } from "@/lib/typings";
import { useFetch } from "../composables/use-fetch";
import {
   MONITOR_LOG_INTERVAL_MILLIS,
   MONITOR_LOG_NUMBER_OF_SAMPLES,
} from "@/lib/constants";
import { useWebcamRecorder } from "../composables/use-webcam-recorder";
import { useInterval } from "../composables/use-interval";
import {
   OfflineMonitorQueue,
   type OfflineMonitorLog,
} from "@/lib/offline-monitor-queue";
import { usePing } from "../composables/use-ping";

const router = useRouter();
const route = useRoute();
const socket = useSocket();
const message = useMessage();
const ping = usePing();

const room = ref<RoomInfo>();
const teacher = ref<TeacherInfo>();
const student = ref<StudentInfo>();
const isJoinRoomLoading = ref(false);
const isLeaveRoomLoading = ref(false);

const webcamRecorder = useWebcamRecorder({
   chunkIntervalMillis: MONITOR_LOG_INTERVAL_MILLIS,
});

const offline = new OfflineMonitorQueue(socket);

async function joinRoom() {
   isJoinRoomLoading.value = true;
   try {
      const data = await socket.emitWithAck<{
         room: RoomInfo;
         student: StudentInfo;
         teacher: TeacherInfo;
         fieldErrors?: Record<string, string>;
      }>(
         "student:join_room",
         {
            roomCode: route.params.roomCode,
            studentName: route.query.studentName,
         },
         5000,
      );

      if (data.fieldErrors) throw "Invalid";

      room.value = data!.room;
      teacher.value = data!.teacher;
      student.value = data!.student;
   } catch {
      router.push("/");
      message.error("Failed to join the room. Please try again.");
   } finally {
      isJoinRoomLoading.value = false;
   }
}

async function leaveRoom() {
   isLeaveRoomLoading.value = true;
   try {
      webcamRecorder.stopRecording();
      offline.clearMemoryOnly();
      await socket.emitWithAck("student:leave_room", {}, 5000);
      router.push("/");
   } catch {
      message.error("Failed to leave the room. Please try again.");
   } finally {
      isLeaveRoomLoading.value = false;
   }
}

webcamRecorder.onClipReady(async (clip) => {
   if (!student.value?.permitted) return;
   if (student.value?.lockMonitorLogId) return;
   if (!room.value) return;

   const uuid = await window.api.getUuid();
   const roomCode = room.value.code;
   const transactionId = crypto.randomUUID();

   // keep memory blob for fast upload
   offline.rememberRecording(transactionId, clip.blob);

   // always persist to disk for offline/restart-safe evidence upload
   const videoPath = await window.api.writeTempVideo(clip.blob);
   offline.rememberVideoPath(transactionId, videoPath);

   const modelResults = await window.api.pyInvoke("use_model", {
      videoPath,
      sampleCount: MONITOR_LOG_NUMBER_OF_SAMPLES,
   });

   const payload: OfflineMonitorLog = {
      uuid,
      transactionId,
      roomCode,
      scores: modelResults.scores,
      isPhonePresent: modelResults.isPhonePresent,
      mimetype: clip.blob.type.split(";")[0],
      startTime: new Date(clip.startTime).toISOString(),
      videoPath,
      createdAt: new Date().toISOString(),
   };

   await offline.sendOrQueueLog(payload);
});

// video follow-up
socket.on("student:upload_recording_url", async (data) => {
   if (!student.value?.permitted) return;
   await offline.handleUploadRecordingUrl({
      transactionId: data.transactionId,
      url: data.url,
   });
});

// connection lifecycle
socket.on("connect", async () => {
   console.log("Rejoining room...");
   await joinRoom();
   await offline.flushQueuedLogs();
});

useInterval(() => {
   socket.emit("student:keep_alive");
}, 60000);

onMounted(async () => {
   await joinRoom();

   // flush once on mount too (connect could have fired already)
   await offline.hydrateFromDisk();
   await offline.flushQueuedLogs();
});

onBeforeUnmount(() => {
   webcamRecorder.stopRecording();
});

// real-time updates
socket.on("student:upsert_room", async (data) => {
   if (!room.value) room.value = data.room;
   else {
      for (const key in data.room) {
         // @ts-ignore
         room.value[key] = data.room[key];
      }
   }
});

socket.on("student:delete_room", async () => {
   message.error("The room has been deleted by the teacher.");
   router.push("/");
});

socket.on("student:upsert_student", async (data) => {
   if (!student.value) student.value = data.student;
   else {
      for (const key in data.student) {
         // @ts-ignore
         student.value[key] = data.student[key];
      }
   }
});

socket.on("student:room_approve", async () => {
   message.success("You have been approved to join the room.");
});

socket.on("student:room_reject", async () => {
   message.error("You have been forbidden from joining the room.");
   router.push("/");
});

watch(
   () => [
      room.value?.status,
      student.value?.permitted,
      student.value?.lockMonitorLogId,
   ],
   () => {
      if (student.value?.lockMonitorLogId) {
         webcamRecorder.stopRecording();
         return;
      }

      if (room.value?.status === "monitoring" && student.value?.permitted) {
         webcamRecorder.startRecording();
      } else {
         webcamRecorder.stopRecording();
      }
   },
   { immediate: true },
);

watch(
   () => student.value?.lockMonitorLogId,
   () => {
      if (student.value?.lockMonitorLogId) {
         window.api.lockWindow();
      } else {
         window.api.unlockWindow();
      }
   },
   { immediate: true },
);
</script>
