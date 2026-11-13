import checkAuth from "../../../middlewares/checkAuth.mjs";
import { resetAdmins } from "../../servers/services/ServersService.mjs";
export default {
  route: "/servers/:id/admins",
  method: "DELETE",
  bearerAuth: true,
  permission: "admins.manage",
  audit: (req) => ({ action: "admins.reset", targetType: "server", serverId: req.validated.path.id }),
  validation: {
    query: {},
    path: {
      type: "object",
      properties: { id: { type: "string", pattern: "^[a-f0-9]{12,64}$" } },
      required: ["id"],
      additionalProperties: false,
    },
    body: {},
  },
  docs: { tags: ["Admins"], description: "Reset live AMXX admins to the container environment." },
  middlewares: [checkAuth],
  entryPoint: async (req, res) => res.jsonOk(200, "ADMINS_RESET", await resetAdmins(req.validated.path.id)),
};
