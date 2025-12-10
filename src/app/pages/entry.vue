<template>
   <div class="flex items-center justify-center w-full h-full">
      <div class="flex flex-col gap-2">
         <NInput
            placeholder="Student name"
            v-model:value="studentName"
            :default-value="store.studentName.value"
         >
            <template #prefix>
               <PhUser />
            </template>
         </NInput>
         <NInput placeholder="Room code" v-model:value="roomCode">
            <template #prefix>
               <PhHouseSimple />
            </template>
         </NInput>
         <NButton
            @click="joinRoom"
            :loading="isLoading"
            :disabled="!studentName || !roomCode"
         >
            Join room
         </NButton>
      </div>
   </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { NButton, NInput } from "naive-ui";
import { PhHouseSimple, PhUser } from "@phosphor-icons/vue";
import { useRouter } from "vue-router";
import { useSocket } from "@/composables/use-socket";
import { useStore } from "@/composables/use-store";
import { getUserId } from "@/lib/user-id";

const router = useRouter();
const socket = useSocket();
const store = useStore();
const studentName = ref("");
const roomCode = ref("");
const isLoading = ref(false);

function joinRoom() {
   isLoading.value = true;
   socket.emit("join_room", {
      userId: getUserId(),
      studentName: studentName.value,
      roomCode: roomCode.value,
   });
}

socket.on("join_room_success", (data) => {
   isLoading.value = false;
   store.setStudentName(data.studentName);
   store.setRoomCode(data.roomCode);
   store.setHostName(data.hostName);
   router.push("/room");
});
</script>
