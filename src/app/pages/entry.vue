<template>
   <div class="flex items-center justify-center w-full h-full">
      <NForm>
         <NFormItem
            label="Student Name"
            :validation-status="studentNameStatus"
            :feedback="studentNameFeedback"
         >
            <NInput
               placeholder="Enter your name"
               v-model:value="studentName"
               :default-value="store.studentName.value"
               :disabled="isLoading"
            >
               <template #prefix>
                  <PhUser />
               </template>
            </NInput>
         </NFormItem>
         <NFormItem
            label="Room Code"
            :validation-status="roomCodeStatus"
            :feedback="roomCodeFeedback"
         >
            <NInput
               placeholder="Enter the room code"
               v-model:value="roomCode"
               :disabled="isLoading"
            >
               <template #prefix>
                  <PhHouseSimple />
               </template>
            </NInput>
         </NFormItem>
         <NButton
            @click="joinRoom"
            :loading="isLoading"
            :disabled="!studentName || !roomCode"
            class="mt-2! w-full!"
         >
            Join room
         </NButton>
      </NForm>
   </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { NButton, NInput, NForm, NFormItem } from "naive-ui";
import { PhHouseSimple, PhUser } from "@phosphor-icons/vue";
import { useRouter } from "vue-router";
import { useSocket } from "@/app/composables/use-socket";
import { useStore } from "@/app/composables/use-store";

const router = useRouter();
const socket = useSocket();
const store = useStore();
const studentName = ref("");
const studentNameStatus = ref<"error" | "success">("success");
const studentNameFeedback = ref("");
const roomCode = ref("");
const roomCodeStatus = ref<"error" | "success">("success");
const roomCodeFeedback = ref("");
const isLoading = ref(false);

function joinRoom() {
   isLoading.value = true;
   studentNameStatus.value = "success";
   studentNameFeedback.value = "";
   roomCodeStatus.value = "success";
   roomCodeFeedback.value = "";
   socket.emit("student:join_room", {
      studentName: studentName.value,
      roomCode: roomCode.value,
   });
}

socket.on("student:join_room_success", (data) => {
   isLoading.value = false;
   store.setStudentName(data.studentName);
   store.setRoomCode(data.roomCode);
   store.setHostName(data.hostName);
   router.push("/room");
});

socket.on("student:join_room_error", (data) => {
   isLoading.value = false;
   const fieldErrors = data.fieldErrors;
   if (fieldErrors.studentName) {
      studentNameStatus.value = "error";
      studentNameFeedback.value = fieldErrors.studentName;
   }

   if (fieldErrors.roomCode) {
      roomCodeStatus.value = "error";
      roomCodeFeedback.value = fieldErrors.roomCode;
   }
});
</script>
