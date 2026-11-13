import checkAuth from "../../../middlewares/checkAuth.mjs";
import { cloneServer } from "../services/ConfigurationOperationsService.mjs";

export default {
  route: "/servers/:id/clone",
  method: "POST",
  bearerAuth: true,
  permission: "servers.manage",
  audit: (req) => ({
    action: "server.clone",
    targetType: "server",
    serverId: req.validated.path.id,
    targetName: req.validated.body.name,
  }),
  validation: {
    query: {},
    path: {
      type: "object",
      properties: { id: { type: "string", pattern: "^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}$" } },
      required: ["id"],
      additionalProperties: false,
    },
    body: {
      type: "object",
      properties: {
        name: { type: "string", minLength: 2, maxLength: 48 },
        port: { anyOf: [{ type: "integer" }, { type: "null" }] },
        startImmediately: { type: "boolean" },
      },
      required: ["name"],
      additionalProperties: false,
    },
  },
  docs: { tags: ["Configuration"], description: "Clone a server with a new identity and newly generated secrets." },
  middlewares: [checkAuth],
  entryPoint: async (req, res) =>
    res.jsonOk(201, "SERVER_CLONED", await cloneServer(req.validated.path.id, req.validated.body, req.user)),
};
