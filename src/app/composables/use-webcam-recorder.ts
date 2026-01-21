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

export interface WebcamRecorderReturn {
   isRecording: Ref<boolean>;
   isPaused: Ref<boolean>;
   stream: Ref<MediaStream | null>;

   startRecording: () => Promise<void>;
   stopRecording: () => void;
   pauseRecording: () => void;
   resumeRecording: () => void;

   onClipReady: (listener: (clip: VideoClip) => void) => void;
}

export function useWebcamRecorder(
   options: RecordingOptions,
): WebcamRecorderReturn {
   const { chunkIntervalMillis = 5000, mimeType = "video/webm;codecs=vp9" } =
      options;

   const videoConstraints = {
      facingMode: "user",
      width: 800,
      height: 600,
      frameRate: 20,
   };

   const audioConstraints = {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
   };

   // State refs
   const isRecording = ref(false);
   const isPaused = ref(false);
   const stream = ref<MediaStream | null>(null);

   // Timers and listeners
   const clipTimer = ref<NodeJS.Timeout | null>(null);
   const clipListeners = new Set<(clip: VideoClip) => void>();

   // MediaRecorder instance
   let mediaRecorder: MediaRecorder | null = null;
   let recordedChunks: Blob[] = [];
   let clipStartTime: number = 0;

   // Initialize webcam stream
   const initStream = async (): Promise<MediaStream> => {
      try {
         const mediaStream = await navigator.mediaDevices.getUserMedia({
            video: videoConstraints,
            audio: audioConstraints,
         });
         stream.value = mediaStream;
         return mediaStream;
      } catch (error) {
         throw new Error(`Failed to access webcam: ${error}`);
      }
   };

   // Create a video clip
   const createVideoClip = (
      blob: Blob,
      startTime: number,
      endTime: number,
   ): VideoClip => {
      return {
         blob,
         startTime,
         endTime,
         duration: endTime - startTime,
      };
   };

   // Send clip to listeners
   const sendClipToListeners = (clip: VideoClip) => {
      for (const listener of clipListeners) {
         try {
            listener(clip);
         } catch (error) {
            console.error("Error in clip listener:", error);
         }
      }
   };

   // Start a new clip recording
   const startNewClip = (mediaStream: MediaStream): void => {
      if (isPaused.value || !isRecording.value) return;

      // Clean up any existing MediaRecorder
      if (mediaRecorder && mediaRecorder.state !== "inactive") {
         mediaRecorder.stop();
         return; // Wait for onstop callback to schedule next
      }

      // Reset chunks
      recordedChunks = [];
      clipStartTime = Date.now();

      // Find supported MIME type
      let selectedMimeType = mimeType;
      if (!MediaRecorder.isTypeSupported(mimeType)) {
         console.warn(
            `MIME type ${mimeType} is not supported, trying alternatives`,
         );

         // Try common MIME types that support video+audio
         const alternatives = [
            "video/webm;codecs=vp9,opus",
            "video/webm;codecs=vp8,opus",
            "video/webm",
            "video/mp4;codecs=avc1,aac",
            "video/mp4",
         ];

         for (const alt of alternatives) {
            if (MediaRecorder.isTypeSupported(alt)) {
               selectedMimeType = alt;
               console.log(`Using alternative MIME type: ${alt}`);
               break;
            }
         }

         if (!MediaRecorder.isTypeSupported(selectedMimeType)) {
            console.error("No supported video/audio MIME types found");
            stopRecording();
            throw new Error("No supported video/audio recording format found");
         }
      }

      try {
         mediaRecorder = new MediaRecorder(mediaStream, {
            mimeType: selectedMimeType,
            videoBitsPerSecond: 800_000,
            audioBitsPerSecond: 64_000,
         });

         // Handle data available
         mediaRecorder.ondataavailable = (event: BlobEvent) => {
            if (event.data && event.data.size > 0) {
               recordedChunks.push(event.data);
            }
         };

         // Handle recording stop
         mediaRecorder.onstop = () => {
            const clipEndTime = Date.now();

            if (recordedChunks.length > 0) {
               const blob = new Blob(recordedChunks, {
                  type: selectedMimeType,
               });
               const clip = createVideoClip(blob, clipStartTime, clipEndTime);

               sendClipToListeners(clip);
            }

            // If still recording and not paused, schedule next clip
            if (isRecording.value && !isPaused.value) {
               scheduleNextClip();
            }
         };

         // Handle errors
         mediaRecorder.onerror = (event) => {
            console.error("MediaRecorder error:", event);

            // Clean up
            mediaRecorder = null;
            recordedChunks = [];

            if (isRecording.value && !isPaused.value) {
               scheduleNextClip();
            }
         };

         // Start recording
         mediaRecorder.start();

         // Clear any existing timer
         if (clipTimer.value) {
            clearTimeout(clipTimer.value);
         }

         // Schedule to stop this clip after intervalMs
         clipTimer.value = setTimeout(() => {
            if (mediaRecorder && mediaRecorder.state === "recording") {
               mediaRecorder.stop();
            }
         }, chunkIntervalMillis);
      } catch (error) {
         console.error("Failed to start MediaRecorder:", error);
         mediaRecorder = null;
         recordedChunks = [];
         throw error;
      }
   };

   // Schedule the next clip
   const scheduleNextClip = () => {
      if (clipTimer.value) {
         clearTimeout(clipTimer.value);
         clipTimer.value = null;
      }

      if (!stream.value || !isRecording.value || isPaused.value) return;

      // Calculate delay until next clip should start
      const now = Date.now();
      const timeSinceLastStart = now - clipStartTime;
      const delay = Math.max(0, chunkIntervalMillis - timeSinceLastStart);

      // Schedule next clip
      clipTimer.value = setTimeout(() => {
         if (stream.value && isRecording.value && !isPaused.value) {
            startNewClip(stream.value);
         }
      }, delay);
   };

   // Start recording
   const startRecording = async (): Promise<void> => {
      if (isRecording.value) return;

      try {
         const mediaStream = await initStream();
         isRecording.value = true;
         isPaused.value = false;

         // Start first clip immediately
         startNewClip(mediaStream);
      } catch (error) {
         console.error("Failed to start recording:", error);
         throw error;
      }
   };

   // Stop recording
   const stopRecording = (): void => {
      if (!isRecording.value) return;

      // Clear any pending timers
      if (clipTimer.value) {
         clearTimeout(clipTimer.value);
         clipTimer.value = null;
      }

      // Stop current recording
      if (mediaRecorder && mediaRecorder.state === "recording") {
         mediaRecorder.stop();
      }

      // Stop all tracks in the stream
      if (stream.value) {
         stream.value.getTracks().forEach((track) => track.stop());
         stream.value = null;
      }

      isRecording.value = false;
      isPaused.value = false;
      mediaRecorder = null;
      recordedChunks = [];
   };

   // Pause recording
   const pauseRecording = (): void => {
      if (!isRecording.value || isPaused.value) return;

      isPaused.value = true;

      // Clear any pending timers
      if (clipTimer.value) {
         clearTimeout(clipTimer.value);
         clipTimer.value = null;
      }

      // Stop current recording if active
      if (mediaRecorder && mediaRecorder.state === "recording") {
         mediaRecorder.stop();
      }
   };

   // Resume recording
   const resumeRecording = (): void => {
      if (!isRecording.value || !isPaused.value) return;

      isPaused.value = false;

      // Start a new clip immediately
      if (stream.value) {
         startNewClip(stream.value);
      }
   };

   // Manage clip listeners
   const onClipReady = (listener: (clip: VideoClip) => void): void => {
      clipListeners.add(listener);
   };

   // Cleanup on unmount
   onUnmounted(() => {
      stopRecording();
      clipListeners.clear();
   });

   return {
      // State
      isRecording,
      isPaused,
      stream,

      // Methods
      startRecording,
      stopRecording,
      pauseRecording,
      resumeRecording,

      // Event listeners
      onClipReady,
   };
}
