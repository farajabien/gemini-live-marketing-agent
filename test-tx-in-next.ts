import { adminDb } from "./lib/firebase-admin";

console.log("adminDb keys", Object.keys(adminDb));

try {
  const op = adminDb.tx.seriesNarratives["id"].update({ foo: "bar" });
  console.log("op", op);
  op.link({ owner: "me" });
  console.log("after link", op);
} catch (e: any) {
  console.error("error!", e.message);
}
