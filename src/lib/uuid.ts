let uuidPromise: Promise<string> | null = null;

export function getUuid(): Promise<string> {
   if (!uuidPromise) {
      uuidPromise = window.api.getUuid();
   }
   return uuidPromise;
}
