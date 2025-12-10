export function getUserId(): string {
   let id = localStorage.getItem("user_id");

   if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("user_id", id);
   }

   return id;
}
