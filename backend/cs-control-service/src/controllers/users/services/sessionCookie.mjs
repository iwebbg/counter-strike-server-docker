import authConfig from "../../../config/auth.mjs";

const sessionCookieSecurityOptions = (req) => ({
  httpOnly: true,
  path: "/",
  sameSite: "strict",
  secure: process.env.AUTH_COOKIE_SECURE === "true" || (process.env.AUTH_COOKIE_SECURE !== "false" && req.secure),
});

export const sessionCookieOptions = (req) => ({
  ...sessionCookieSecurityOptions(req),
  maxAge: authConfig.cookieLifetime * 1000,
});

export const sessionCookieClearOptions = (req) => sessionCookieSecurityOptions(req);

export function setSessionCookie(req, res, session) {
  res.cookie(
    authConfig.cookieName,
    JSON.stringify({
      access_token: session.accessToken,
      access_token_expires_at: session.accessTokenExpiresAt,
      refresh_token: session.refreshToken,
      refresh_token_expires_at: session.refreshTokenExpiresAt,
    }),
    sessionCookieOptions(req),
  );
}

export function cookieSession(req) {
  const value = req.cookies?.[authConfig.cookieName];
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
