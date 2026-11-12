import passport from "passport";
import authConfig from "../config/auth.mjs";
import { UserService } from "../controllers/users/services/UserService.mjs";

export function accessTokenFromRequest(req) {
  const authorization = req.headers.authorization;
  if (authorization?.startsWith("Bearer ")) return authorization.slice(7).trim() || null;
  const cookie = req.cookies?.[authConfig.cookieName];
  if (!cookie) return null;
  try {
    return JSON.parse(cookie).access_token ?? null;
  } catch {
    return null;
  }
}

export default async function checkAuth(req, res, next) {
  const accessToken = accessTokenFromRequest(req);
  if (!accessToken) return res.jsonError(401, "UNAUTHORIZED");
  const service = new UserService();
  const cached = await service.getUserCache(accessToken);
  if (cached) {
    req.userCurrentSession = accessToken;
    req.user = cached;
    return next();
  }
  return passport.authenticate("bearer", { session: false }, async (error, user) => {
    if (error || !user) return res.jsonError(401, "UNAUTHORIZED");
    req.userCurrentSession = accessToken;
    req.user = user;
    await service.setUserCache(accessToken, user);
    return next();
  })(req, res, next);
}
