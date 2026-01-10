import { toCamelCase } from "./string";

/**
 * Recursively converts all keys of an object or array to camelCase.
 */
export function keysToCamel<T>(obj: T): T {
   if (Array.isArray(obj)) {
      return obj.map((item) => keysToCamel(item)) as any;
   } else if (obj !== null && typeof obj === "object") {
      const newObj: any = {};
      for (const [key, value] of Object.entries(obj)) {
         newObj[toCamelCase(key)] = keysToCamel(value);
      }
      return newObj;
   }
   return obj;
}
