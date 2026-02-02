<template>
   <div class="flex flex-col gap-2">
      <NText>Webcam Recorder Test Page</NText>

      <NText>Recording?: {{ webcamRecorder.isRecording.value }}</NText>
      <NButton
         @click="
            () =>
               webcamRecorder.isRecording.value
                  ? webcamRecorder.stopRecording()
                  : webcamRecorder.startRecording()
         "
      >
         {{
            webcamRecorder.isRecording.value
               ? "Stop Recording"
               : "Start Recording"
         }}
      </NButton>
   </div>
</template>

<script setup lang="ts">
import { NButton, NSpin, NText, useMessage } from "naive-ui";
import { WarningLevel } from "@/lib/typings";
import {
   MONITOR_LOG_INTERVAL_MILLIS,
   MONITOR_LOG_NUMBER_OF_SAMPLES,
} from "@/lib/constants";
import { useWebcamRecorder } from "../composables/use-webcam-recorder";
const webcamRecorder = useWebcamRecorder({
   chunkIntervalMillis: MONITOR_LOG_INTERVAL_MILLIS,
});

webcamRecorder.onClipReady(async (clip) => {
   let f1Start = performance.now();
   let videoPath = await window.api.writeTempVideo(clip.blob);
   let f1Time = performance.now() - f1Start;
   console.log(videoPath);

   let d1Start = performance.now();
   let modelResults: {
      scores: { warning_level: WarningLevel };
      isPhonePresent: boolean;
   } = await window.api.pyInvoke("use_model", {
      videoPath,
      sampleCount: MONITOR_LOG_NUMBER_OF_SAMPLES,
   });
   let d1Time = performance.now() - d1Start;

   if (import.meta.env.DEV) {
      console.log(`Model performance:   f1: ${f1Time}ms   d1: ${d1Time}ms`);
   }

   // cleanup temp frames
   window.api.cleanupTempVideo(videoPath);

   console.log("------------------ done! ------------------");
   console.log("scores:", modelResults.scores);
   console.log("isPhonePresent:", modelResults.isPhonePresent);
});
</script>
