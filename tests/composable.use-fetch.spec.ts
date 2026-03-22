import { beforeEach, describe, expect, it, vi } from "vitest";

let mockSocket: any;

vi.mock("@/lib/socket", () => ({
   get socket() {
      return Promise.resolve(mockSocket);
   },
}));

async function importUseFetch() {
   const mod = await import("@/app/composables/use-fetch");
   return mod.useFetch;
}

describe("useFetch", () => {
   beforeEach(() => {
      vi.resetModules();
      vi.stubEnv("VITE_API_URL", "https://api.test/");
      window.api.getUuid = vi.fn().mockResolvedValue("uuid-1");
      window.api.getApiKey = vi.fn().mockResolvedValue("api-key-1");
      global.fetch = vi.fn();
      mockSocket = {
         connected: true,
         id: "sid-1",
         once: vi.fn(),
      };
   });

   it("sends JSON payload with auth headers and resolves camel-cased response", async () => {
      (global.fetch as any).mockResolvedValueOnce({
         ok: true,
         json: async () => ({ message: "ok", data_value: 1 }),
      });

      const useFetch = await importUseFetch();
      const api = useFetch<{ dataValue: number }>("/rooms/:roomId", "POST");

      const res = await api.execute({
         params: { roomId: "A B" },
         body: { snake_case: "value" },
      });

      expect(global.fetch).toHaveBeenCalledWith(
         "https://api.test/rooms/A%20B",
         expect.objectContaining({
            method: "POST",
            credentials: "include",
            headers: expect.objectContaining({
               "X-UUID": "uuid-1",
               "X-SID": "sid-1",
               "X-API-KEY": "api-key-1",
               "Content-Type": "application/json",
            }),
            body: JSON.stringify({ snake_case: "value" }),
         }),
      );
      expect(res).toEqual({ message: "ok", dataValue: 1 });
      expect(api.error).toBeNull();
   });

   it("waits for socket connection when socket starts disconnected", async () => {
      let connectHandler: (() => void) | undefined;
      mockSocket = {
         connected: false,
         id: "sid-late",
         once: vi.fn((event: string, cb: () => void) => {
            if (event === "connect") connectHandler = cb;
         }),
      };

      (global.fetch as any).mockResolvedValueOnce({
         ok: true,
         json: async () => ({ message: "ok" }),
      });

      const useFetch = await importUseFetch();
      const api = useFetch("/ping");

      const pending = api.execute();
      expect(global.fetch).not.toHaveBeenCalled();
      await Promise.resolve();
      expect(mockSocket.once).toHaveBeenCalledWith(
         "connect",
         expect.any(Function),
      );

      connectHandler?.();
      await pending;

      expect(global.fetch).toHaveBeenCalledTimes(1);
   });

   it("maps server error detail and field errors when response is not ok", async () => {
      (global.fetch as any).mockResolvedValueOnce({
         ok: false,
         json: async () => ({
            detail: {
               message: "Validation failed",
               fieldErrors: { room_code: "Invalid code" },
            },
         }),
      });

      const useFetch = await importUseFetch();
      const api = useFetch("/rooms/:roomId");

      await expect(
         api.execute({ params: { roomId: "1" } }),
      ).rejects.toMatchObject({ message: "Validation failed" });
      expect(api.error).toEqual({
         message: "Validation failed",
         fieldErrors: { roomCode: "Invalid code" },
      });
      expect(api.isLoading).toBe(false);
   });

   it("throws in development when URL params remain unresolved", async () => {
      const oldEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";
      try {
         (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => ({ message: "ok" }),
         });

         const useFetch = await importUseFetch();
         const api = useFetch("/rooms/:roomId/:studentId");

         await expect(api.execute({ params: { roomId: 1 } })).rejects.toThrow(
            "Unresolved URL params",
         );
      } finally {
         process.env.NODE_ENV = oldEnv;
      }
   });

   it("keeps FormData body untouched without forcing Content-Type", async () => {
      (global.fetch as any).mockResolvedValueOnce({
         ok: true,
         json: async () => ({ message: "ok" }),
      });
      const useFetch = await importUseFetch();
      const api = useFetch("/upload", "POST");
      const body = new FormData();
      body.append("file", new Blob(["x"]), "clip.webm");

      await api.execute({ body });

      const [, init] = (global.fetch as any).mock.calls[0];
      expect(init.body).toBe(body);
      expect(init.headers["Content-Type"]).toBeUndefined();
   });
});
