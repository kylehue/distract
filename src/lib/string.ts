export function toCamelCase(str: string): string {
   return (
      str
         // Replace any separators (space, _, -) with a single space
         .replace(/[-_\s]+/g, " ")
         // Lowercase the first character of the string
         .replace(/^[A-Z]/, (match) => match.toLowerCase())
         // Uppercase any character following a space
         .replace(/ (.)/g, (_, char) => char.toUpperCase())
         // Remove remaining spaces
         .replace(/\s+/g, "")
   );
}
