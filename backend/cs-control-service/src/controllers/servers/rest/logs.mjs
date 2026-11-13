import checkAuth from "../../../middlewares/checkAuth.mjs";
import { serverLogs } from "../services/ServersService.mjs";
export default {
  route: "/servers/:id/logs",
  method: "GET",
  bearerAuth: true,
  permission: "servers.read",
  validation: {
    query: {},
    path: {
      type: "object",
      properties: { id: { type: "string", pattern: "^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}$" } },
      required: ["id"],
      additionalProperties: false,
    },
    body: {},
  },
  docs: { tags: ["Servers"], description: "Read recent server logs." },
  middlewares: [checkAuth],
  entryPoint: async (req, res) => res.jsonOk(200, "SUCCESS", await serverLogs(req.validated.path.id)),
};
