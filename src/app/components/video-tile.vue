<template>
   <div class="relative">
      <div class="tile">
         <video ref="videoRef" autoplay playsinline muted class="tile-video" />
         <img v-if="showFaceOutline && stream" src="/face-outline.png" class="face-outline" />
         <div v-if="!stream" class="tile-no-video">
            <PhUser size="50%" />
         </div>
      </div>
      <div class="flex items-center gap-2 absolute w-full top-0 p-1 px-2">
         <NText
            class="bg-[rgba(0,0,0,0.5)] px-2 rounded text-xs flex items-center gap-2"
         >
            Camera Preview
            <InfoTooltip>
               If the camera doesn't work, make sure permissions are granted and
               other apps aren't using the camera.
            </InfoTooltip>
         </NText>
      </div>
   </div>
</template>

<script setup lang="ts">
import { watch, onUnmounted, useTemplateRef } from "vue";
import { PhUser } from "@phosphor-icons/vue";
import InfoTooltip from "./info-tooltip.vue";
import { NText } from "naive-ui";

const props = defineProps<{
   stream: MediaStream | null | undefined;
   showFaceOutline?: boolean;
}>();

const videoRef = useTemplateRef("videoRef");

function attach(stream: MediaStream | null | undefined) {
   if (!stream || !videoRef.value) return;
   videoRef.value.srcObject = stream;
}

function detach() {
   if (!videoRef.value) return;
   videoRef.value.srcObject = null;
}

watch(
   () => props.stream,
   (newStream, oldStream) => {
      if (oldStream) detach();
      if (newStream) attach(newStream);
   },
   { immediate: true },
);

onUnmounted(() => {
   detach();
});
</script>

<style scoped>
.tile {
   position: relative;
   border-radius: 2px;
   overflow: hidden;
   background: #1c1c1c;
   aspect-ratio: 16 / 9;
   flex: none;
}
.tile-video {
   width: 100%;
   height: 100%;
   object-fit: cover;
   display: block;
}
.tile-no-video {
   position: absolute;
   inset: 0;
   display: flex;
   align-items: center;
   justify-content: center;
   color: #555;
   font-size: 14px;
}
.face-outline {
   position: absolute;
   inset: 0;
   width: 100%;
   height: 100%;
   object-fit: cover;
   pointer-events: none;
}
</style>
