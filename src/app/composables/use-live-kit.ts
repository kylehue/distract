import { ref, onUnmounted, type Ref } from "vue";
import {
   Room,
   RoomEvent,
   LocalVideoTrack,
   LocalAudioTrack,
} from "livekit-client";
import { useFetch } from "./use-fetch";

export function useLiveKit(stream: Ref<MediaStream | null>) {
   const room = ref<Room | null>(null);

   const videoTrack = ref<LocalVideoTrack | null>(null);
   const audioTrack = ref<LocalAudioTrack | null>(null);

   const isConnected = ref(false);

   const fetchToken = useFetch<string>("/api/livekit-token/student", "POST");

   async function connect(roomCode: string) {
      if (!stream.value) {
         throw new Error("MediaStream not initialized");
      }

      const url = import.meta.env.VITE_LIVEKIT_URL;
      const studentId = await window.api.getUuid();
      if (!studentId) throw new Error("Student not found");

      const res = await fetchToken.execute({
         body: {
            identity: studentId,
            room: roomCode,
         },
      });

      const token = res.data;
      if (!token) throw new Error("Failed to generate token");

      const _room = new Room();
      room.value = _room;

      // Use EXISTING tracks from shared stream
      const rawVideoTrack = stream.value.getVideoTracks()[0];
      const rawAudioTrack = stream.value.getAudioTracks()[0];

      if (!rawVideoTrack || !rawAudioTrack) {
         throw new Error("Missing media tracks");
      }

      videoTrack.value = new LocalVideoTrack(rawVideoTrack);
      audioTrack.value = new LocalAudioTrack(rawAudioTrack);

      await _room.connect(url, token, {
         autoSubscribe: false,
      });

      // publish tracks
      await _room.localParticipant.publishTrack(
         videoTrack.value as LocalVideoTrack,
      );
      await _room.localParticipant.publishTrack(
         audioTrack.value as LocalAudioTrack,
      );

      isConnected.value = true;

      _room.on(RoomEvent.Disconnected, () => {
         isConnected.value = false;
      });
   }

   function attachVideo(element: HTMLVideoElement) {
      if (!stream.value) return;
      element.srcObject = stream.value;
      element.muted = true;
      element.play();
   }

   function disconnect() {
      if (room.value) {
         room.value.disconnect();
         room.value = null;
      }

      videoTrack.value = null;
      audioTrack.value = null;

      isConnected.value = false;
   }

   onUnmounted(() => {
      disconnect();
   });

   return {
      connect,
      disconnect,
      attachVideo,
      isConnected,
   };
}
