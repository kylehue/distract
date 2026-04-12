<template>
   <div class="flex items-center justify-center w-full h-full p-4">
      <div class="flex flex-col gap-4 justify-center">
         <div class="flex flex-col">
            <NText class="font-medium"
               >Please look at the camera and align your face</NText
            >
            <NText class="text-xs" :depth="3"
               >Before you enter the room, we need to capture a quick photo of
               you. This will be used as your avatar so your teacher can easily
               recognize and monitor participants during the session.</NText
            >
         </div>
         <VideoTile
            :stream="mediaStream.stream.value"
            show-face-outline
            class="w-[100vmin]"
         />

         <div class="flex justify-start">
            <NButton
               type="primary"
               :loading="isCaptureLoading"
               :disabled="!isCameraReady"
               @click="captureAndJoinRoom()"
            >
               Capture and Join Room
            </NButton>
         </div>
      </div>

      <video ref="captureVideoRef" autoplay playsinline muted class="hidden" />
   </div>
</template>

<script setup lang="ts">
import { NButton, NText, useMessage } from "naive-ui";
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import VideoTile from "@/app/components/video-tile.vue";
import { useMediaStream } from "@/app/composables/use-media-stream";
import { useSocket } from "../composables/use-socket";

const router = useRouter();
const route = useRoute();
const message = useMessage();
const mediaStream = useMediaStream();
const socket = useSocket();

const captureVideoRef = ref<HTMLVideoElement | null>(null);
const isCaptureLoading = ref(false);
const isCameraReady = ref(false);

function attachCaptureVideo(stream: MediaStream | null) {
   if (!captureVideoRef.value) return;
   captureVideoRef.value.srcObject = stream;
}

async function ensureCaptureVideoReady() {
   if (!captureVideoRef.value) {
      throw new Error("Camera preview is not ready.");
   }

   const video = captureVideoRef.value;
   if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) return;

   await new Promise<void>((resolve, reject) => {
      const onLoadedData = () => {
         cleanup();
         resolve();
      };
      const onError = () => {
         cleanup();
         reject(new Error("Unable to read camera frame."));
      };
      const cleanup = () => {
         video.removeEventListener("loadeddata", onLoadedData);
         video.removeEventListener("error", onError);
      };

      video.addEventListener("loadeddata", onLoadedData, { once: true });
      video.addEventListener("error", onError, { once: true });
   });
}

async function captureImageBlob() {
   await ensureCaptureVideoReady();

   const video = captureVideoRef.value!;
   const width = video.videoWidth || 800;
   const height = video.videoHeight || 600;

   const canvas = document.createElement("canvas");
   canvas.width = width;
   canvas.height = height;

   const ctx = canvas.getContext("2d");
   if (!ctx) throw new Error("Failed to create canvas context.");

   ctx.drawImage(video, 0, 0, width, height);

   return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
         if (!blob) {
            reject(new Error("Failed to capture image."));
            return;
         }
         resolve(blob);
      }, "image/jpeg");
   });
}

async function uploadAvatar(blob: Blob) {
   const roomCode = route.params.roomCode;
   const mimeType = "image/jpeg";

   // get upload_url from server
   const data = await socket.emitWithAck<{ ok: boolean; uploadUrl: string }>(
      "student:get_upload_url_for_avatar",
      {
         roomCode,
      },
      15000,
   );
   if (!data.ok || !data.uploadUrl) throw new Error("Failed to upload avatar.");

   // upload to the upload_url
   const res = await fetch(data.uploadUrl, {
      method: "PUT",
      headers: {
         "Content-Type": mimeType,
         "x-upsert": "true",
      },
      body: blob,
   });

   if (!res.ok) {
      throw new Error("Failed to upload avatar.");
   }
}

async function captureAndJoinRoom() {
   isCaptureLoading.value = true;
   try {
      const avatarBlob = await captureImageBlob();
      await uploadAvatar(avatarBlob);
   } catch (error: any) {
      message.error(
         error?.message ?? "Failed to capture avatar. Please try again.",
      );
   } finally {
      isCaptureLoading.value = false;
   }

   router.push({
      path: "/room/" + route.params.roomCode,
      query: {
         studentName: route.query.studentName,
      },
   });
}

watch(
   () => mediaStream.stream.value,
   (stream) => {
      attachCaptureVideo(stream);

      isCameraReady.value = false;

      if (!stream) return;

      const video = captureVideoRef.value;
      if (!video) return;

      const checkReady = () => {
         if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            isCameraReady.value = true;
         }
      };

      video.addEventListener("loadeddata", checkReady, { once: true });

      // fallback (important, because some browsers are weird)
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
         isCameraReady.value = true;
      }
   },
   { immediate: true },
);

onMounted(async () => {
   try {
      await mediaStream.start();
   } catch (error: any) {
      message.error(error?.message ?? "Unable to start camera.");
   }
});

onBeforeUnmount(() => {
   attachCaptureVideo(null);
   mediaStream.stop();
});
</script>
