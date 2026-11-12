import passport from "passport";
import Strategy from "passport-http-bearer";
import Db from "./Db.mjs";
import { publicUser } from "../controllers/users/services/UserService.mjs";

let configured = false;
export function configurePassport() {
  if (configured) return;
  configured = true;
  passport.use(new Strategy(async (accessToken, done) => {
    try {
      const db = await new Db().db();
      const row = await db("oauth_access_tokens as token")
        .join("users as user", "user.id", "token.user_id")
        .where({ "token.id": accessToken, "token.revoked": false, "user.active": true })
        .where("token.expires_at", ">", new Date())
        .select("user.*")
        .first();
      return row ? done(null, publicUser(row), { scope: "*" }) : done(null, false);
    } catch (error) {
      return done(error, false);
    }
  }));
}
