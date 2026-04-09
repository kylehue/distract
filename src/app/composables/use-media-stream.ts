import { ref, onUnmounted } from "vue";

export function useMediaStream() {
   const stream = ref<MediaStream | null>(null);

   const isActive = ref(false);

   function handleMediaError(err: any) {
      switch (err.name) {
         case "NotAllowedError":
            throw new Error("User denied camera/mic permission.");
         case "NotFoundError":
            throw new Error("No camera or microphone found.");
         case "NotReadableError":
            throw new Error("Camera is already in use by another app.");
         case "OverconstrainedError":
            throw new Error("Constraints cannot be satisfied.");
         case "SecurityError":
            throw new Error("Blocked due to insecure context (use HTTPS).");
         default:
            throw new Error("Unknown media error.");
      }
   }

   async function start() {
      if (stream.value) return stream.value;

      try {
         const mediaStream = await navigator.mediaDevices.getUserMedia({
            video: {
               facingMode: "user",
               width: 800,
               height: 600,
               frameRate: 20,
            },
            audio: {
               echoCancellation: false,
               noiseSuppression: false,
               autoGainControl: false,
            },
         });

         stream.value = mediaStream;
         isActive.value = true;

         return mediaStream;
      } catch (err: any) {
         handleMediaError(err);
      }
   }

   function stop() {
      if (!stream.value) return;

      stream.value.getTracks().forEach((track) => track.stop());
      stream.value = null;
      isActive.value = false;
   }

   function getVideoTrack(): MediaStreamTrack | null {
      return stream.value?.getVideoTracks()[0] ?? null;
   }

   function getAudioTrack(): MediaStreamTrack | null {
      return stream.value?.getAudioTracks()[0] ?? null;
   }

   onUnmounted(() => {
      stop();
   });

   return {
      stream,
      isActive,
      start,
      stop,
      getVideoTrack,
      getAudioTrack,
   };
}
