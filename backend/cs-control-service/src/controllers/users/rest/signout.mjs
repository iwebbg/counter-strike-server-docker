import authConfig from "../../../config/auth.mjs";
import checkAuth from "../../../middlewares/checkAuth.mjs";
import { UserService } from "../services/UserService.mjs";
import { sessionCookieOptions } from "../services/sessionCookie.mjs";

export default {
  route: "/v1/users/signout",
  method: "POST",
  bearerAuth: true,
  validation: { query: {}, path: {}, body: {} },
  docs: { tags: ["Users"], description: "Revoke the current session." },
  middlewares: [checkAuth],
  entryPoint: async (req, res) => {
    await new UserService().signout(req.userCurrentSession);
    res.clearCookie(authConfig.cookieName, sessionCookieOptions(req));
    return res.jsonOk(200, "SUCCESS");
  },
};
