import checkAuth from "../../../middlewares/checkAuth.mjs";
import { serverAction } from "../services/ServersService.mjs";
export default {
  route: "/servers/:id/:action",
  method: "POST",
  bearerAuth: true,
  permission: "servers.operate",
  audit: (req) => ({
    action: `server.${req.validated.path.action}`,
    targetType: "server",
    serverId: req.validated.path.id,
  }),
  validation: {
    query: {},
    path: {
      type: "object",
      properties: {
        id: { type: "string", pattern: "^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}$" },
        action: { type: "string", enum: ["start", "stop", "restart", "pause", "unpause"] },
      },
      required: ["id", "action"],
      additionalProperties: false,
    },
    body: {},
  },
  docs: { tags: ["Servers"], description: "Start, stop, restart, pause or resume a server." },
  middlewares: [checkAuth],
  entryPoint: async (req, res) =>
    res.jsonOk(200, "SUCCESS", await serverAction(req.validated.path.id, req.validated.path.action)),
};
