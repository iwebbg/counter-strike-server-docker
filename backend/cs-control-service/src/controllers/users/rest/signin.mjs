import { UserService } from "../services/UserService.mjs";
import { setSessionCookie } from "../services/sessionCookie.mjs";

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
    if (!session) return res.jsonError(401, "INVALID_CREDENTIALS");
    setSessionCookie(req, res, session);
    return res.jsonOk(200, "SUCCESS", { user: session.user, access_token_expires_at: session.accessTokenExpiresAt });
  },
};
