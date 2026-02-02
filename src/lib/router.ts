import { createRouter, createWebHashHistory, RouteRecordRaw } from "vue-router";
import EntryPage from "@/app/pages/entry.vue";
import RoomPage from "@/app/pages/room.vue";

const routes: RouteRecordRaw[] = [
   { path: "/", redirect: "/entry" },
   { path: "/entry", component: EntryPage },
   { path: "/room/:roomCode", component: RoomPage },
   // {
   //    path: "/_test-monitor",
   //    component: () => import("@/app/pages/_test-monitor.vue"),
   // },
];

const router = createRouter({
   history: createWebHashHistory(),
   routes,
});

export { router };
