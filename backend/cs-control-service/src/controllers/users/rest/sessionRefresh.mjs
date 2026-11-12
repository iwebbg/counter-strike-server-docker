import { UserService } from "../services/UserService.mjs";
import { cookieSession, setSessionCookie } from "../services/sessionCookie.mjs";

export default {
  route: "/v1/users/session/refresh",
  method: "POST",
  bearerAuth: false,
  validation: { query: {}, path: {}, body: {} },
  docs: { tags: ["Users"], description: "Rotate an HttpOnly cookie session." },
  middlewares: [],
  entryPoint: async (req, res) => {
    const current = cookieSession(req);
    if (!current?.refresh_token) return res.jsonError(401, "SESSION_REFRESH_FAILED");
    const session = await new UserService().refreshSession(current.refresh_token);
    if (!session) return res.jsonError(401, "SESSION_REFRESH_FAILED");
    setSessionCookie(req, res, session);
    return res.jsonOk(200, "SUCCESS", { user: session.user, access_token_expires_at: session.accessTokenExpiresAt });
  },
};
