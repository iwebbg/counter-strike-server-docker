import checkAuth from "../../../middlewares/checkAuth.mjs";
import { migrateServerImage } from "../services/ServersService.mjs";

export default {
  route: "/servers/:id/image",
  method: "PUT",
  bearerAuth: true,
  permission: "servers.manage",
  audit: (req) => ({ action: "server.image.update", targetType: "server", serverId: req.validated.path.id }),
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
  docs: {
    tags: ["Servers"],
    description: "Migrate a panel-managed server to the configured image while preserving volumes.",
  },
  middlewares: [checkAuth],
  entryPoint: async (req, res) =>
    res.jsonOk(200, "SERVER_IMAGE_UPDATED", await migrateServerImage(req.validated.path.id)),
};
