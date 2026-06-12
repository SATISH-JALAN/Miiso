import { db } from "../src/db/client.js";
import { protectionEvents, approvalCache } from "../src/db/schema.js";

async function clearDb() {
  console.log("Clearing fake data...");
  await db.delete(protectionEvents);
  console.log("Cleared protectionEvents");
  await db.delete(approvalCache);
  console.log("Cleared approvalCache");
  process.exit(0);
}

clearDb().catch(err => {
  console.error(err);
  process.exit(1);
});
