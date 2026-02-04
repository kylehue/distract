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
   <template v-else-if="!room || !teacher || !student"> Missing data </template>
   <div v-else class="flex flex-col w-full h-full">
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
            :loading="patchLeaveRoom.isLoading"
         >
            Leave room
         </NButton>
      </div>
   </div>
</template>

<script setup lang="ts">
import { NButton, NSpin, NText, useMessage } from "naive-ui";
import { onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useSocket } from "@/app/composables/use-socket";
import { RoomInfo, StudentInfo, TeacherInfo } from "@/lib/typings";
import { useFetch } from "../composables/use-fetch";
import {
   MONITOR_LOG_INTERVAL_MILLIS,
   MONITOR_LOG_NUMBER_OF_SAMPLES,
} from "@/lib/constants";
import { useWebcamRecorder } from "../composables/use-webcam-recorder";
import { useInterval } from "../composables/use-interval";

const router = useRouter();
const route = useRoute();
const socket = useSocket();
const message = useMessage();
const room = ref<RoomInfo>();
const teacher = ref<TeacherInfo>();
const student = ref<StudentInfo>();
const webcamRecorder = useWebcamRecorder({
   chunkIntervalMillis: MONITOR_LOG_INTERVAL_MILLIS,
});

const postJoinRoom = useFetch<{
   room: RoomInfo;
   student: StudentInfo;
   teacher: TeacherInfo;
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

      room.value = data!.room;
      teacher.value = data!.teacher;
      student.value = data!.student;
   } catch {
      router.push("/");
      message.error(
         postJoinRoom.error?.message ||
            "Failed to join the room. Please try again.",
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
            "Failed to leave the room. Please try again.",
      );
   }
}

const recordingMap = new Map<string, Blob>();
webcamRecorder.onClipReady(async (clip) => {
   if (!student.value?.permitted) return;
   if (student.value?.lockMonitorLogId) return;
   if (!room.value) {
      console.warn("No room found; cannot send monitoring data");
      return;
   }
   let roomCode = room.value.code;
   let transactionId = crypto.randomUUID();

   // send as promise because we don't know when the recording follow-up will be requested
   // we don't want to await here because that will degrade real-time performance
   recordingMap.set(transactionId, clip.blob);
   let videoPath = await window.api.writeTempVideo(clip.blob);
   let modelResults = await window.api.pyInvoke("use_model", {
      videoPath,
      sampleCount: MONITOR_LOG_NUMBER_OF_SAMPLES,
   });

   // cleanup temp frames
   window.api.cleanupTempVideo(videoPath);

   socket.emit("student:post_monitor_logs", {
      transactionId: transactionId,
      roomCode: roomCode,
      scores: modelResults.scores,
      isPhonePresent: modelResults.isPhonePresent,
      mimetype: clip.blob.type.split(";")[0],
      startTime: new Date(clip.startTime).toISOString(),
   });
});

// video follow-up
socket.on("student:upload_recording_url", async (data) => {
   if (!student.value?.permitted) return;
   let transactionId = data.transactionId;
   let uploadUrl = data.url;

   let recording = recordingMap.get(transactionId);
   if (!recording) {
      console.warn("No video found for transaction ID:", transactionId);
      return;
   }

   try {
      const result = await fetch(uploadUrl, {
         method: "PUT",
         headers: {
            "Content-Type": recording.type.split(";")[0],
         },
         body: recording,
      });
      if (!result.ok) {
         throw new Error("Failed to upload recording");
      }
   } catch (error) {
      console.error(error);
   }
});

// on reconnect
socket.on("connect", () => {
   console.log("Rejoining room...");
   joinRoom();
});

socket.on("student:upsert_room", async (data) => {
   if (!room.value) {
      room.value = data.room;
   } else {
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
   if (!student.value) {
      student.value = data.student;
   } else {
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

useInterval(() => {
   // tell the server we're still in the room so we can properly disconnect
   // otherwise our uuid-sid mapping will expire
   socket.emit("room_ping");
}, 60000);

onMounted(() => {
   joinRoom();
});

watch(
   () => [
      room.value?.status,
      student.value?.permitted,
      student.value?.lockMonitorLogId,
   ],
   () => {
      if (student.value?.lockMonitorLogId) {
         window.api.lockWindow();
         webcamRecorder.stopRecording();
         return;
      } else {
         window.api.unlockWindow();
      }

      if (room.value?.status === "monitoring" && student.value?.permitted) {
         webcamRecorder.startRecording();
      } else {
         webcamRecorder.stopRecording();
      }
   },
   {
      immediate: true,
   },
);
</script>
