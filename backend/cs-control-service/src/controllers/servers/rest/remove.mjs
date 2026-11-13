import checkAuth from "../../../middlewares/checkAuth.mjs";
import { removeServer } from "../services/ServersService.mjs";
export default {
  route: "/servers/:id",
  method: "DELETE",
  bearerAuth: true,
  permission: "servers.manage",
  audit: (req) => ({ action: "server.delete", targetType: "server", serverId: req.validated.path.id }),
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
  docs: { tags: ["Servers"], description: "Remove a stopped panel-managed container while preserving volumes." },
  middlewares: [checkAuth],
  entryPoint: async (req, res) => res.jsonOk(200, "SUCCESS", await removeServer(req.validated.path.id)),
};
