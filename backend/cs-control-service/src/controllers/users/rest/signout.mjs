import authConfig from "../../../config/auth.mjs";
import { UserService } from "../services/UserService.mjs";
import { cookieSession, sessionCookieClearOptions } from "../services/sessionCookie.mjs";

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
      await new UserService().signout(session.access_token, session.refresh_token);
    }
    res.clearCookie(authConfig.cookieName, sessionCookieClearOptions(req));
    return res.jsonOk(200, "SUCCESS");
  },
};
