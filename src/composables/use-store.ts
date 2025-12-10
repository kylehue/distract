import { ref } from "vue";

let _store: ReturnType<typeof createStore> | null = null;

function createStore() {
   const studentName = ref("");
   const roomCode = ref("");
   const hostName = ref("");

   function setStudentName(n: string) {
      studentName.value = n;
   }

   function setRoomCode(r: string) {
      roomCode.value = r;
   }

   function setHostName(n: string) {
      hostName.value = n;
   }

   function clearRoom() {
      hostName.value = "";
      roomCode.value = "";
   }

   return {
      studentName,
      setStudentName,
      roomCode,
      setRoomCode,
      hostName,
      setHostName,
      clearRoom,
   };
}

// public function used by components
export function useStore() {
   if (!_store) {
      _store = createStore();
   }
   return _store;
}
