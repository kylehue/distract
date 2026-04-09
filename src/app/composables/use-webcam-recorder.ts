import { fixWebmDuration } from "@fix-webm-duration/fix";
import { ref, onUnmounted, type Ref } from "vue";

export interface RecordingOptions {
   chunkIntervalMillis: number;
   mimeType?: string;
}

export interface VideoClip {
   blob: Blob;
   startTime: number;
   endTime: number;
   duration: number;
}

export function useWebcamRecorder(
   stream: Ref<MediaStream | null>,
   options: RecordingOptions,
) {
   const { chunkIntervalMillis = 5000, mimeType = "video/webm" } =
      options;

   const isRecording = ref(false);
   const isPaused = ref(false);

   const clipTimer = ref<NodeJS.Timeout | null>(null);
   const clipListeners = new Set<(clip: VideoClip) => void>();

   let mediaRecorder: MediaRecorder | null = null;
   let recordedChunks: Blob[] = [];
   let clipStartTime = 0;

   const createVideoClip = async (
      blob: Blob,
      startTime: number,
      endTime: number,
   ): Promise<VideoClip> => {
      return {
         blob: await fixWebmDuration(blob, chunkIntervalMillis),
         startTime,
         endTime,
         duration: endTime - startTime,
      };
   };

   const sendClipToListeners = (clip: VideoClip) => {
      for (const listener of clipListeners) {
         listener(clip);
      }
   };

   const startNewClip = () => {
      if (!stream.value) throw new Error("Stream not initialized");
      if (isPaused.value || !isRecording.value) return;

      if (mediaRecorder && mediaRecorder.state !== "inactive") {
         mediaRecorder.stop();
         return;
      }

      recordedChunks = [];
      clipStartTime = Date.now();

      mediaRecorder = new MediaRecorder(stream.value, {
         mimeType,
         videoBitsPerSecond: 800_000,
         audioBitsPerSecond: 64_000,
      });

      mediaRecorder.ondataavailable = (event: BlobEvent) => {
         if (event.data.size > 0) recordedChunks.push(event.data);
      };

      mediaRecorder.onstop = async () => {
         const end = Date.now();

         if (recordedChunks.length > 0) {
            const blob = new Blob(recordedChunks, { type: mimeType });
            const clip = await createVideoClip(blob, clipStartTime, end);
            sendClipToListeners(clip);
         }

         if (isRecording.value && !isPaused.value) {
            scheduleNextClip();
         }
      };

      mediaRecorder.start();

      if (clipTimer.value) clearTimeout(clipTimer.value);

      clipTimer.value = setTimeout(() => {
         if (mediaRecorder?.state === "recording") {
            mediaRecorder.stop();
         }
      }, chunkIntervalMillis);
   };

   const scheduleNextClip = () => {
      if (clipTimer.value) clearTimeout(clipTimer.value);

      clipTimer.value = setTimeout(() => {
         if (isRecording.value && !isPaused.value) {
            startNewClip();
         }
      }, 0);
   };

   const startRecording = async () => {
      if (!stream.value) throw new Error("Stream not initialized");
      if (isRecording.value) return;

      isRecording.value = true;
      isPaused.value = false;

      startNewClip();
   };

   const stopRecording = () => {
      if (!isRecording.value) return;

      if (clipTimer.value) clearTimeout(clipTimer.value);

      if (mediaRecorder?.state === "recording") {
         mediaRecorder.stop();
      }

      isRecording.value = false;
      isPaused.value = false;
      mediaRecorder = null;
      recordedChunks = [];
   };

   const pauseRecording = () => {
      if (!isRecording.value || isPaused.value) return;

      isPaused.value = true;

      if (clipTimer.value) clearTimeout(clipTimer.value);

      if (mediaRecorder?.state === "recording") {
         mediaRecorder.stop();
      }
   };

   const resumeRecording = () => {
      if (!isRecording.value || !isPaused.value) return;

      isPaused.value = false;
      startNewClip();
   };

   const onClipReady = (listener: (clip: VideoClip) => void) => {
      clipListeners.add(listener);
   };

   onUnmounted(() => {
      stopRecording();
      clipListeners.clear();
   });

   return {
      isRecording,
      isPaused,
      startRecording,
      stopRecording,
      pauseRecording,
      resumeRecording,
      onClipReady,
   };
}
