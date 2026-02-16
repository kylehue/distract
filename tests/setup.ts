import { afterEach, vi } from "vitest";

declare global {
   interface Window {
      // @ts-ignore
      api: Record<string, any>;
   }
}

if (typeof window !== "undefined") {
   if (!window.api) {
      // @ts-ignore
      window.api = {};
   }

   // Safe defaults for modules that import at top-level during tests.
   if (!window.api.getUuid) {
      window.api.getUuid = vi.fn().mockResolvedValue("test-uuid");
   }
   if (!window.api.getApiKey) {
      window.api.getApiKey = vi.fn().mockResolvedValue("test-api-key");
   }
}

afterEach(() => {
   vi.clearAllMocks();
});
