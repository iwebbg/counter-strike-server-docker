import crypto from "node:crypto";

const safeHeaderName = (value) => {
  const name = String(value || "x-auth-request-email")
    .trim()
    .toLowerCase();
  return /^[a-z0-9-]+$/.test(name) ? name : "x-auth-request-email";
};

export function trustedSsoEnabled(environment = process.env) {
  return environment.SSO_ENABLED === "1" && Boolean(environment.SSO_SHARED_SECRET);
}

export function trustedSsoEmail(req, environment = process.env) {
  const value = req.get(safeHeaderName(environment.SSO_EMAIL_HEADER));
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function trustedSsoSecretMatches(value, environment = process.env) {
  const expected = String(environment.SSO_SHARED_SECRET || "");
  const received = String(value || "");
  if (!expected || received.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}
