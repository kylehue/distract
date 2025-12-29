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
               :disabled="isJoinRoomLoading"
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
               :disabled="isJoinRoomLoading"
            >
               <template #prefix>
                  <PhHouseSimple />
               </template>
            </NInput>
         </NFormItem>
         <NButton
            @click="joinRoom()"
            :loading="isJoinRoomLoading"
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
import { useSocketEvent } from "../composables/use-socket-event";

const router = useRouter();
const studentName = ref("");
const studentNameStatus = ref<"error" | "success">("success");
const studentNameFeedback = ref("");
const roomCode = ref("");
const roomCodeStatus = ref<"error" | "success">("success");
const roomCodeFeedback = ref("");

const { execute: joinRoom, isLoading: isJoinRoomLoading } = useSocketEvent({
   executeEvent: "student:join_room",
   successEvent: "student:join_room_success",
   errorEvent: "student:join_room_error",
   executePayload: () => ({
      studentName: studentName.value,
      roomCode: roomCode.value,
   }),
   onBeforeExecute() {
      studentNameStatus.value = "success";
      studentNameFeedback.value = "";
      roomCodeStatus.value = "success";
      roomCodeFeedback.value = "";
      return true;
   },
   onSuccess(data) {
      router.push({
         path: "/room/" + data.room.code,
         query: {
            studentName: data.student.studentName,
         },
      });
   },
   onError(errorData) {
      const fieldErrors = errorData.fieldErrors;
      if (fieldErrors.studentName) {
         studentNameStatus.value = "error";
         studentNameFeedback.value = fieldErrors.studentName;
      }

      if (fieldErrors.roomCode) {
         roomCodeStatus.value = "error";
         roomCodeFeedback.value = fieldErrors.roomCode;
      }
   },
});
</script>
