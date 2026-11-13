import authConfig from "../../../config/auth.mjs";
import { UserService } from "../services/UserService.mjs";
import { cookieSession, sessionCookieClearOptions } from "../services/sessionCookie.mjs";
import { writeAudit } from "../../audit/services/AuditService.mjs";

export default {
  route: "/v1/users/signout",
  method: "POST",
  bearerAuth: false,
  validation: { query: {}, path: {}, body: {} },
  docs: { tags: ["Users"], description: "Revoke the current session." },
  middlewares: [],
  entryPoint: async (req, res) => {
    const session = cookieSession(req);
    if (session?.access_token || session?.refresh_token) {
      const service = new UserService();
      req.user = session.access_token ? await service.getUserCache(session.access_token) : null;
      await writeAudit(req, { action: "auth.signout", category: "auth", status: "success", targetType: "operator" });
      await service.signout(session.access_token, session.refresh_token);
    }
    res.clearCookie(authConfig.cookieName, sessionCookieClearOptions(req));
    return res.jsonOk(200, "SUCCESS");
  },
};
