<template>
   <div class="flex items-center justify-center w-full h-full p-4">
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
            :disabled="!isPrivacyConsentChecked"
            class="mt-2! w-full!"
         >
            Join room
         </NButton>
         <div class="flex w-full mt-2">
            <NCheckbox v-model:checked="isPrivacyConsentChecked">
               I have read and agree to the
               <RouterLink to="/privacy-policy" class="link">
                  Privacy Policy
               </RouterLink>
            </NCheckbox>
         </div>
      </NForm>
      <NText
         class="absolute left-2 bottom-1 text-xs pointer-events-none select-none font-mono"
         :depth="3"
      >
         v{{ appVersion }}
      </NText>
      <ThemeSwitch class="!absolute bottom-1 right-1" />
   </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import {
   NButton,
   NInput,
   NForm,
   NFormItem,
   NText,
   useMessage,
   NCheckbox,
} from "naive-ui";
import { PhHouseSimple, PhUser } from "@phosphor-icons/vue";
import { RouterLink, useRouter } from "vue-router";
import { RoomInfo, StudentInfo } from "@/lib/typings";
import { useSocket } from "../composables/use-socket";
import ThemeSwitch from "../components/theme-switch.vue";

const router = useRouter();
const message = useMessage();
const socket = useSocket();
const studentName = ref("");
const studentNameStatus = ref<"error" | "success">("success");
const studentNameFeedback = ref("");
const roomCode = ref("");
const roomCodeStatus = ref<"error" | "success">("success");
const roomCodeFeedback = ref("");
const appVersion = ref("");
const isLoading = ref(false);
const isPrivacyConsentChecked = ref(false);

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
      }>(
         "student:join_room",
         {
            studentName: studentName.value,
            roomCode: roomCode.value,
         },
         5000,
      );

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

onMounted(async () => {
   appVersion.value = await window.api.getVersion();
});
</script>
