import { defineConfig, loadEnv } from "vite";
import path from "node:path";
import electron from "vite-plugin-electron/simple";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import pkg from "./package.json" assert { type: "json" };

export default ({ mode }: any) => {
   const env = loadEnv(mode, process.cwd(), "VITE_");

   return defineConfig({
      define: {
         __APP_VERSION__: JSON.stringify(pkg.version),
      },
      plugins: [
         vue(),
         tailwindcss(),
         electron({
            main: {
               // Shortcut of `build.lib.entry`.
               entry: "electron/main.ts",
            },
            preload: {
               // Shortcut of `build.rollupOptions.input`.
               // Preload scripts may contain Web assets, so use the `build.rollupOptions.input` instead `build.lib.entry`.
               input: path.join(__dirname, "electron/preload.ts"),
            },
            // Ployfill the Electron and Node.js API for Renderer process.
            // If you want use Node.js in Renderer process, the `nodeIntegration` needs to be enabled in the Main process.
            // See 👉 https://github.com/electron-vite/vite-plugin-electron-renderer
            renderer:
               process.env.NODE_ENV === "test"
                  ? // https://github.com/electron-vite/vite-plugin-electron-renderer/issues/78#issuecomment-2053600808
                    undefined
                  : {},
         }),
      ],
      resolve: {
         alias: {
            "@": path.resolve(__dirname, "./src"),
         },
      },
      server: {
         port: 5173,
         proxy: {
            "/api": {
               target: env.VITE_API_URL,
               changeOrigin: true,
            },
         },
      },
   });
};
