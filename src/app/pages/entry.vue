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
               :disabled="postJoinRoom.isLoading"
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
               :disabled="postJoinRoom.isLoading"
            >
               <template #prefix>
                  <PhHouseSimple />
               </template>
            </NInput>
         </NFormItem>
         <NButton
            @click="joinRoom()"
            :loading="postJoinRoom.isLoading"
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
import { useFetch } from "../composables/use-fetch";
import { RoomInfo, StudentInfo } from "@/lib/typings";

const router = useRouter();
const studentName = ref("");
const studentNameStatus = ref<"error" | "success">("success");
const studentNameFeedback = ref("");
const roomCode = ref("");
const roomCodeStatus = ref<"error" | "success">("success");
const roomCodeFeedback = ref("");
const message = useMessage();

const postJoinRoom = useFetch<{
   room: RoomInfo;
   student: StudentInfo;
   teacher: any;
}>("/api/join_room", "POST");
async function joinRoom() {
   studentNameStatus.value = "success";
   studentNameFeedback.value = "";
   roomCodeStatus.value = "success";
   roomCodeFeedback.value = "";

   try {
      const { data } = await postJoinRoom.execute({
         body: {
            studentName: studentName.value,
            roomCode: roomCode.value,
         },
      });

      router.push({
         path: "/room/" + data!.room.code,
         query: {
            studentName: data!.student.name,
         },
      });
   } catch {
      if (!postJoinRoom.error) {
         return;
      }

      if (!postJoinRoom.error.fieldErrors) {
         message.error(postJoinRoom.error.message);
         return;
      }

      const fieldErrors = postJoinRoom.error.fieldErrors;
      if (fieldErrors.studentName) {
         studentNameStatus.value = "error";
         studentNameFeedback.value = fieldErrors.studentName;
      }

      if (fieldErrors.roomCode) {
         roomCodeStatus.value = "error";
         roomCodeFeedback.value = fieldErrors.roomCode;
      }
   }
}
</script>
