import bcrypt from "bcrypt";
import crypto from "node:crypto";
import Db from "../utils/Db.mjs";
import { normalizedEmail } from "../controllers/users/services/UserService.mjs";

const name = String(process.env.BOOTSTRAP_ADMIN_NAME ?? "").trim();
const email = normalizedEmail(process.env.BOOTSTRAP_ADMIN_EMAIL);
const password = String(process.env.BOOTSTRAP_ADMIN_PASSWORD ?? "");

if (name.length < 2 || !email.includes("@") || password.length < 12) {
  console.error(
    "BOOTSTRAP_ADMIN_NAME, BOOTSTRAP_ADMIN_EMAIL and a 12+ character BOOTSTRAP_ADMIN_PASSWORD are required.",
  );
  process.exitCode = 1;
} else {
  try {
    await Db.init();
    const db = await new Db().db();
    const existing = await db("users").where({ normalized_email: email }).first();
    if (existing) {
      console.log(`Admin account ${existing.email} already exists; no changes were made.`);
    } else {
      const id = crypto.randomUUID();
      await db("users").insert({
        id,
        name,
        email,
        normalized_email: email,
        password: await bcrypt.hash(password, 12),
        role: "owner",
        preferred_locale: "bg",
        active: true,
        email_verified_at: new Date(),
      });
      console.log(`Created active admin account ${email} (${id}).`);
    }
  } finally {
    await Db.stop();
  }
}
