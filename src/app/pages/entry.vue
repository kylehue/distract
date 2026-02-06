<template>
   <div class="flex items-center justify-center w-full h-full">
      <NForm @keydown.enter="joinRoom()">
         <NFormItem
            label="Student Name"
            :validation-status="studentNameStatus"
            :feedback="studentNameFeedback"
         >
            <NInput
               placeholder="Enter your name"
               v-model:value="studentName"
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
            @click="joinRoom()"
            :loading="isLoading"
            class="mt-2! w-full!"
         >
            Join room
         </NButton>
      </NForm>
   </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { NButton, NInput, NForm, NFormItem, useMessage } from "naive-ui";
import { PhHouseSimple, PhUser } from "@phosphor-icons/vue";
import { useRouter } from "vue-router";
import { RoomInfo, StudentInfo } from "@/lib/typings";
import { useSocket } from "../composables/use-socket";

const router = useRouter();
const studentName = ref("");
const studentNameStatus = ref<"error" | "success">("success");
const studentNameFeedback = ref("");
const roomCode = ref("");
const roomCodeStatus = ref<"error" | "success">("success");
const roomCodeFeedback = ref("");
const message = useMessage();
const socket = useSocket();
const isLoading = ref(false);
async function joinRoom() {
   studentNameStatus.value = "success";
   studentNameFeedback.value = "";
   roomCodeStatus.value = "success";
   roomCodeFeedback.value = "";
   isLoading.value = true;

   try {
      const data = await socket.emitWithAck<{
         room: RoomInfo;
         student: StudentInfo;
         fieldErrors?: Record<string, string>;
      }>("student:join_room", {
         studentName: studentName.value,
         roomCode: roomCode.value,
      }, 5000);

      if (data.fieldErrors) throw { fieldErrors: data.fieldErrors };

      router.push({
         path: "/room/" + data!.room.code,
         query: {
            studentName: data!.student.name,
         },
      });
   } catch (error: any) {
      if (!error?.fieldErrors) {
         message.error("An unknown error occurred while joining the room.");
         console.error("Unknown error in joinRoom:", error);
         return;
      }

      const fieldErrors = error.fieldErrors;
      if (fieldErrors.studentName) {
         studentNameStatus.value = "error";
         studentNameFeedback.value = fieldErrors.studentName;
      }

      if (fieldErrors.roomCode) {
         roomCodeStatus.value = "error";
         roomCodeFeedback.value = fieldErrors.roomCode;
      }
   } finally {
      isLoading.value = false;
   }
}
</script>
