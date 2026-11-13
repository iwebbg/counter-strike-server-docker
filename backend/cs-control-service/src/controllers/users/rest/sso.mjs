import { writeAudit } from "../../audit/services/AuditService.mjs";
import { UserService } from "../services/UserService.mjs";
import { setSessionCookie } from "../services/sessionCookie.mjs";
import { trustedSsoEmail, trustedSsoEnabled, trustedSsoSecretMatches } from "../services/trustedSso.mjs";

export default {
  route: "/v1/users/sso",
  method: "POST",
  bearerAuth: false,
  validation: { query: {}, path: {}, body: { type: "object", additionalProperties: false } },
  docs: { tags: ["Users"], description: "Exchange a trusted forward-auth identity for a panel session." },
  middlewares: [],
  entryPoint: async (req, res) => {
    if (!trustedSsoEnabled() || !trustedSsoSecretMatches(req.get("x-cs-sso-secret"))) {
      return res.jsonError(404, "SSO_NOT_AVAILABLE");
    }
    const email = trustedSsoEmail(req);
    const session = email ? await new UserService().signinTrusted(email) : null;
    if (!session) {
      await writeAudit(req, {
        action: "auth.sso",
        category: "auth",
        status: "failure",
        targetType: "operator",
        targetName: email || "missing-identity",
      });
      return res.jsonError(401, "SSO_OPERATOR_NOT_ALLOWED");
    }
    req.user = session.user;
    setSessionCookie(req, res, session);
    await writeAudit(req, { action: "auth.sso", category: "auth", status: "success", targetType: "operator" });
    return res.jsonOk(200, "SUCCESS", {
      user: session.user,
      access_token_expires_at: session.accessTokenExpiresAt,
    });
  },
};
