import { createRouter, createWebHashHistory, RouteRecordRaw } from "vue-router";
import EntryPage from "@/app/pages/entry.vue";
import RoomPage from "@/app/pages/room.vue";

const routes: RouteRecordRaw[] = [
   { path: "/", redirect: "/entry" },
   { path: "/entry", component: EntryPage },
   { path: "/room/:roomCode", component: RoomPage },
];

const router = createRouter({
   history: createWebHashHistory(),
   routes,
});

export { router };
