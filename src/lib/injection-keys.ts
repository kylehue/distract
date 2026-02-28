import type { InjectionKey, Ref } from "vue";

export const THEME_INJECTION_KEY: InjectionKey<Ref<"light" | "dark">> =
   Symbol("theme-mode");
