import authConfig from "../../../config/auth.mjs";

export const sessionCookieOptions = (req) => ({
  httpOnly: true,
  path: "/",
  sameSite: "strict",
  secure: process.env.NODE_ENV === "production" || req.secure,
  maxAge: authConfig.cookieLifetime * 1000,
});

export function setSessionCookie(req, res, session) {
  res.cookie(authConfig.cookieName, JSON.stringify({
    access_token: session.accessToken,
    access_token_expires_at: session.accessTokenExpiresAt,
    refresh_token: session.refreshToken,
    refresh_token_expires_at: session.refreshTokenExpiresAt,
  }), sessionCookieOptions(req));
}

export function cookieSession(req) {
  const value = req.cookies?.[authConfig.cookieName];
  if (!value) return null;
  try { return JSON.parse(value); } catch { return null; }
}
