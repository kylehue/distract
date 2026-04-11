<template>
   <div class="tile">
      <video ref="videoRef" autoplay playsinline muted class="tile-video" />
      <div v-if="!stream" class="tile-no-video">
         <PhUser size="50%" />
      </div>
   </div>
</template>

<script setup lang="ts">
import { watch, onUnmounted, useTemplateRef } from "vue";
import { PhUser } from "@phosphor-icons/vue";

const props = defineProps<{
   stream: MediaStream | null | undefined;
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
</style>
