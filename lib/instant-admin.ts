import { init, id } from "@instantdb/admin";
import schema, { AppSchema } from "@/instant.schema";

export const adminDb = init({
  appId: process.env.NEXT_PUBLIC_INSTANT_APP_ID!,
  adminToken: process.env.INSTANT_APP_ADMIN_TOKEN!,
  schema,
});
export { id };
