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
