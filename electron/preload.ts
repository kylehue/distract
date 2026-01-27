import { ipcRenderer, contextBridge } from "electron";

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld("ipcRenderer", {
   on(...args: Parameters<typeof ipcRenderer.on>) {
      const [channel, listener] = args;
      return ipcRenderer.on(channel, (event, ...args) =>
         listener(event, ...args),
      );
   },
   off(...args: Parameters<typeof ipcRenderer.off>) {
      const [channel, ...omit] = args;
      return ipcRenderer.off(channel, ...omit);
   },
   send(...args: Parameters<typeof ipcRenderer.send>) {
      const [channel, ...omit] = args;
      return ipcRenderer.send(channel, ...omit);
   },
   invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
      const [channel, ...omit] = args;
      return ipcRenderer.invoke(channel, ...omit);
   },

   // You can expose other APTs you need here.
   // ...
});

contextBridge.exposeInMainWorld("api", {
   on: (channel: string, cb: (data: any) => void) =>
      ipcRenderer.on(channel, (_evt, data) => cb(data)),
   off: (channel: string, listener: (...args: any[]) => void) => {
      ipcRenderer.removeListener(channel, listener);
   },
   invoke: (type: string, payload: any) => {
      const correlationId = Date.now() + Math.random().toString(16);
      return ipcRenderer.invoke("py:invoke", {
         type,
         correlationId,
         ...payload,
      });
   },
   getUuid: () => ipcRenderer.invoke("get-student-uuid"),
   showNotification: (payload: { title: string; body: string }) =>
      ipcRenderer.invoke("show-notification", payload),
   lockWindow: () => ipcRenderer.invoke("lock-window"),
   unlockWindow: () => ipcRenderer.invoke("unlock-window"),
});
