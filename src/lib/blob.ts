function waitFor(el: HTMLElement | HTMLMediaElement, event: string) {
   return new Promise<void>((resolve, reject) => {
      const onEvent = () => {
         cleanup();
         resolve();
      };
      const onError = () => {
         cleanup();
         reject(new Error(`Failed waiting for ${event}`));
      };
      const cleanup = () => {
         el.removeEventListener(event, onEvent);
         el.removeEventListener("error", onError);
      };

      el.addEventListener(event, onEvent, { once: true });
      el.addEventListener("error", onError, { once: true });
   });
}

function seek(video: HTMLVideoElement, time: number) {
   return new Promise<void>((resolve, reject) => {
      const onSeeked = () => {
         cleanup();
         resolve();
      };
      const onError = () => {
         cleanup();
         reject(new Error("Seek failed"));
      };
      const cleanup = () => {
         video.removeEventListener("seeked", onSeeked);
         video.removeEventListener("error", onError);
      };

      video.addEventListener("seeked", onSeeked, { once: true });
      video.addEventListener("error", onError, { once: true });
      video.currentTime = time;
   });
}

async function ensureDuration(video: HTMLVideoElement): Promise<number> {
   if (isFinite(video.duration) && video.duration > 0) {
      return video.duration;
   }

   // force duration calculation
   video.currentTime = 1e9;

   await new Promise<void>((resolve) => {
      video.ontimeupdate = () => {
         video.ontimeupdate = null;
         resolve();
      };
   });

   const duration = video.duration;

   // reset
   video.currentTime = 0;

   if (!isFinite(duration) || duration <= 0) {
      throw new Error("Unable to determine video duration");
   }

   return duration;
}

export async function videoBlobToBase64Frames(
   video: Blob,
   framesCount: number
): Promise<string[]> {
   if (framesCount <= 0) return [];

   const videoEl = document.createElement("video");
   videoEl.muted = true;
   videoEl.playsInline = true;
   videoEl.src = URL.createObjectURL(video);

   await waitFor(videoEl, "loadedmetadata");

   const duration = await ensureDuration(videoEl);

   const canvas = document.createElement("canvas");
   canvas.width = videoEl.videoWidth;
   canvas.height = videoEl.videoHeight;
   const ctx = canvas.getContext("2d")!;

   const frames: string[] = [];

   for (let i = 0; i < framesCount; i++) {
      const time = (i + 0.5) * (duration / framesCount);

      await seek(videoEl, Math.min(time, duration - 0.001));

      ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
      frames.push(canvas.toDataURL("image/jpeg", 0.85));
   }

   URL.revokeObjectURL(videoEl.src);
   return frames;
}

export async function compressVideoBlob(
   inputBlob: Blob,
   options?: {
      maxWidth?: number; // default 640
      fps?: number; // default 20
      videoQuality?: number; // 0-1, default 0.6
   }
): Promise<Blob> {
   const maxWidth = options?.maxWidth || 640;
   const fps = options?.fps || 20;
   const videoQuality = options?.videoQuality ?? 0.6;

   // Create video element
   const video = document.createElement("video");
   video.src = URL.createObjectURL(inputBlob);
   video.muted = true;
   video.playsInline = true;

   // Wait for metadata
   await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = reject;
   });

   const scale = Math.min(maxWidth / video.videoWidth, 1);
   const canvas = document.createElement("canvas");
   canvas.width = video.videoWidth * scale;
   canvas.height = video.videoHeight * scale;
   const ctx = canvas.getContext("2d")!;

   // Capture canvas as video stream
   const canvasStream = (canvas as any).captureStream(fps);

   // Capture original audio
   const audioCtx = new AudioContext();
   const audioSource = audioCtx.createMediaElementSource(video);
   const dest = audioCtx.createMediaStreamDestination();
   audioSource.connect(dest);
   audioSource.connect(audioCtx.destination); // optional for playback

   // Combine video + audio
   const combinedStream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...dest.stream.getAudioTracks(),
   ]);

   // Determine bitrate
   const minBitrate = 100_000; // 100 kbps
   const maxBitrate = 800_000; // 800 kbps
   const videoBits = Math.floor(
      minBitrate + (maxBitrate - minBitrate) * videoQuality
   );

   // Setup MediaRecorder
   const chunks: Blob[] = [];
   const recorder = new MediaRecorder(combinedStream, {
      mimeType: "video/webm; codecs=vp8,opus",
      videoBitsPerSecond: videoBits,
      audioBitsPerSecond: 64_000,
   });

   recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
   };

   recorder.start();

   // Draw frames in sync with video
   video.play();
   const duration = video.duration;
   const interval = 1000 / fps;

   await new Promise<void>((resolve) => {
      const drawFrame = () => {
         if (video.paused || video.ended) {
            resolve();
            return;
         }
         ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
         setTimeout(drawFrame, interval);
      };
      drawFrame();
   });

   // Stop recorder after video ends
   recorder.stop();

   await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
   });

   URL.revokeObjectURL(video.src);
   audioCtx.close();

   return new Blob(chunks, { type: "video/webm" });
}
