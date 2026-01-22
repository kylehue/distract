import { ipcMain, Notification } from "electron";

function showNotification(title: string, body: string) {
   new Notification({ title, body }).show();
}

export function setupNotifications() {
   ipcMain.handle("show-notification", (event, payload) => {
      showNotification(payload.title, payload.body);
   });
}
