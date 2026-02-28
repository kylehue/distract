import { ipcMain, nativeTheme } from "electron";

export type ThemeMode = "light" | "dark";

function normalizeTheme(value: unknown): ThemeMode {
   return value === "dark" ? "dark" : "light";
}

export async function setupTheme() {
   ipcMain.handle("get-theme", () => {
      return nativeTheme.shouldUseDarkColors ? "dark" : "light";
   });

   ipcMain.handle("set-theme", (_event, mode: ThemeMode) => {
      const normalizedMode = normalizeTheme(mode);
      nativeTheme.themeSource = normalizedMode;
      return normalizedMode;
   });
}
