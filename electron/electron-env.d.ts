/// <reference types="vite-plugin-electron/electron-env" />

declare namespace NodeJS {
   interface ProcessEnv {
      /**
       * The built directory structure
       *
       * ```tree
       * ├─┬─┬ dist
       * │ │ └── index.html
       * │ │
       * │ ├─┬ dist-electron
       * │ │ ├── main.js
       * │ │ └── preload.js
       * │
       * ```
       */
      APP_ROOT: string;
      /** /dist/ or /public/ */
      VITE_PUBLIC: string;
   }
}

// Used in Renderer process, expose in `preload.ts`
interface Window {
   ipcRenderer: import("electron").IpcRenderer;
   api: {
      on: (channel: string, cb: (data: any) => void) => void;
      off: (channel: string, listener: (...args: any[]) => void) => void;
      invoke: (type: string, payload: any) => Promise<any>;
      getUuid: () => Promise<string>;
      showNotification: (payload: { title: string; body: string }) => Promise<void>;
      lockWindow: () => Promise<void>;
      unlockWindow: () => Promise<void>;
      getVersion: () => Promise<string>;
      getApiKey: () => Promise<string>;
   };
}
