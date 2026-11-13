import { UserService } from "../services/UserService.mjs";
import { setSessionCookie } from "../services/sessionCookie.mjs";
import { writeAudit } from "../../audit/services/AuditService.mjs";

export default {
  route: "/v1/users/signin",
  method: "POST",
  bearerAuth: false,
  validation: {
    query: {},
    path: {},
    body: {
      type: "object",
      properties: {
        email: { type: "string", format: "email", maxLength: 254 },
        password: { type: "string", minLength: 1, maxLength: 128 },
      },
      required: ["email", "password"],
      additionalProperties: false,
    },
  },
  docs: { tags: ["Users"], description: "Create an access and refresh session." },
  middlewares: [],
  entryPoint: async (req, res) => {
    const session = await new UserService().signin(req.validated.body.email, req.validated.body.password);
    if (!session) {
      await writeAudit(req, {
        action: "auth.signin",
        category: "auth",
        status: "failure",
        targetType: "operator",
        targetName: req.validated.body.email,
      });
      return res.jsonError(401, "INVALID_CREDENTIALS");
    }
    req.user = session.user;
    setSessionCookie(req, res, session);
    await writeAudit(req, { action: "auth.signin", category: "auth", status: "success", targetType: "operator" });
    return res.jsonOk(200, "SUCCESS", { user: session.user, access_token_expires_at: session.accessTokenExpiresAt });
  },
};
