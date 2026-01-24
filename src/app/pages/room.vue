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
   <template v-else-if="!roomInfo || !teacherInfo || !studentInfo">
      Missing data
   </template>
   <div v-else class="flex flex-col w-full h-full">
      <div class="flex">
         <div class="flex flex-col">
            <NText class="text-xs" depth="3">Host</NText>
            <NText>{{ teacherInfo.displayName }}</NText>
         </div>
      </div>
      <div class="flex flex-1 items-center justify-center">
         <NText
            v-if="studentInfo.permitted"
            class="text-lg"
            :type="roomInfo.status === 'monitoring' ? 'error' : 'default'"
         >
            {{
               roomInfo.status === "monitoring"
                  ? "You are currently being monitored."
                  : "The teacher hasn't started monitoring yet."
            }}
         </NText>
         <NText v-else class="text-lg text-warning">
            Your join request is pending approval from the teacher.
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
import { onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useSocket } from "@/app/composables/use-socket";
import {
   RoomInfo,
   StudentInfo,
   TeacherInfo,
   WarningLevel,
} from "@/lib/typings";
import { useFetch } from "../composables/use-fetch";
import {
   MONITOR_LOG_INTERVAL_MILLIS,
   MONITOR_LOG_NUMBER_OF_SAMPLES,
} from "@/lib/constants";
import { videoBlobToBase64Frames } from "@/lib/blob";
import { useWebcamRecorder } from "../composables/use-webcam-recorder";

const router = useRouter();
const route = useRoute();
const socket = useSocket();
const message = useMessage();
const roomInfo = ref<RoomInfo>();
const teacherInfo = ref<TeacherInfo>();
const studentInfo = ref<StudentInfo>();
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

      roomInfo.value = data!.room;
      teacherInfo.value = data!.teacher;
      studentInfo.value = data!.student;
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
   if (!studentInfo.value?.permitted) return;
   if (!roomInfo.value) {
      console.warn("No room found; cannot send monitoring data");
      return;
   }
   let roomCode = roomInfo.value.code;

   let transactionId = crypto.randomUUID();

   // send as promise because we don't know when the recording follow-up will be requested
   // we don't want to await here because that will degrade real-time performance
   recordingMap.set(transactionId, clip.blob);

   let frames = await videoBlobToBase64Frames(
      clip.blob, // use uncompressed
      MONITOR_LOG_NUMBER_OF_SAMPLES,
   );

   let scores: {
      warning_level: WarningLevel;
   } = await window.api.invoke("extract_scores_from_base64_frames", {
      frames,
   });

   // skip
   if (scores.warning_level === "none") return;

   socket.emit("student:post_monitor_logs", {
      transactionId: transactionId,
      roomCode: roomCode,
      scores: scores,
      mimetype: clip.blob.type.split(";")[0],
   });
});

// video follow-up
socket.on("student:upload_recording_url", async (data) => {
   if (!studentInfo.value?.permitted) return;
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

socket.on("student:update_room", async (data) => {
   const room = data.room as RoomInfo;
   roomInfo.value = room;
});

socket.on("student:delete_room", async () => {
   message.error("The room has been deleted by the teacher.");
   router.push("/");
});

socket.on("student:update_student", async (data) => {
   const student = data.student as StudentInfo;
   studentInfo.value = student;
});

socket.on("student:room_approve", async () => {
   message.success("You have been approved to join the room.");
});

socket.on("student:room_reject", async () => {
   message.error("You have been forbidden from joining the room.");
   router.push("/");
});

onMounted(() => {
   joinRoom();
});

watch(
   () => [roomInfo.value?.status, studentInfo.value?.permitted],
   () => {
      if (
         roomInfo.value?.status === "monitoring" &&
         studentInfo.value?.permitted
      ) {
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
