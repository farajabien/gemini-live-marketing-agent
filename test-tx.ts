import { adminDb } from "./lib/firebase-admin";

const op = adminDb.tx.seriesNarratives["id"].update({ foo: "bar" });
console.log("op", op);
if (typeof op.link === "function") {
  console.log("link is function!");
  op.link({ owner: "me" });
  console.log("after link", op);
} else {
  console.log("link IS NOT A FUNCTION");
}
