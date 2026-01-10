import { onUnmounted, ref } from "vue";

export function useVideoRecorder(options: { chunkMillis?: number } = {}) {
   const chunkMillis = options.chunkMillis || 5000; // default 5s
   let mediaRecorder: MediaRecorder | null = null;
   let stream: MediaStream | null = null;
   let listener: ((chunk: Blob) => any) | null = null;
   let recording = false;

   async function start() {
      if (recording) return;
      recording = true;

      try {
         stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
         });

         const recordChunk = () => {
            if (!stream || !recording) return;

            mediaRecorder = new MediaRecorder(stream, {
               mimeType: "video/webm; codecs=vp8,opus",
            });

            mediaRecorder.ondataavailable = (event) => {
               if (event.data && event.data.size > 0 && listener) {
                  listener(event.data);
               }
            };

            mediaRecorder.onstop = () => {
               // Automatically start next chunk
               if (recording) {
                  recordChunk();
               }
            };

            mediaRecorder.start();

            // Stop after chunkMillis
            setTimeout(() => {
               mediaRecorder?.stop();
            }, chunkMillis);
         };

         // Start the first chunk
         recordChunk();
      } catch (err) {
         console.error("Failed to start video recorder:", err);
         recording = false;
      }
   }

   function pause() {
      if (!mediaRecorder) return;

      if (mediaRecorder.state === "recording") {
         mediaRecorder.pause();
      }
   }

   function stop() {
      recording = false;
      if (mediaRecorder && mediaRecorder.state === "recording") {
         mediaRecorder.stop();
      }
      stream?.getTracks().forEach((t) => t.stop());
      mediaRecorder = null;
      stream = null;
   }

   function onChunk(cb: (chunk: Blob) => any) {
      listener = cb;
   }

   onUnmounted(stop);

   return {
      start,
      pause,
      stop,
      onChunk,
   };
}
