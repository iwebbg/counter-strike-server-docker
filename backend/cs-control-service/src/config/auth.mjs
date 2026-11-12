import "./dotenv.mjs";

const integer = (value, fallback) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export default {
  cookieName: process.env.AUTH_COOKIE_NAME ?? "cs_control_session",
  accessTokenLifetime: integer(process.env.AUTH_ACCESS_TOKEN_LIFETIME, 3600),
  refreshTokenLifetime: integer(process.env.AUTH_REFRESH_TOKEN_LIFETIME, 1209600),
  cookieLifetime: integer(process.env.AUTH_COOKIE_TTL_LIFETIME, 1209600),
};
