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
import { onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useSocket } from "@/app/composables/use-socket";
import { RoomInfo, RoomStudentInfo } from "@/lib/typings";
import { useFetch } from "../composables/use-fetch";

const router = useRouter();
const route = useRoute();
const socket = useSocket();
const message = useMessage();
const roomInfo = ref<RoomInfo>();

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

      // socket.emit("student:leave_room", {});

      window.api.invoke("stop_monitoring", {});
      router.push("/");
   } catch {
      message.error(
         fetchLeaveRoom.error?.message ||
            "Failed to leave the room. Please try again."
      );
   }
}

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

onMounted(() => {
   joinRoom();
});
</script>
