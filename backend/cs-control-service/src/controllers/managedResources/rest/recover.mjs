import checkAuth from "../../../middlewares/checkAuth.mjs";
import { recoverManagedResource } from "../services/ManagedResourceService.mjs";

export default {
  route: "/managed-resources/:id/recover",
  method: "POST",
  bearerAuth: true,
  permission: "servers.manage",
  audit: (req) => ({ action: "resource.recover", targetType: "server", serverId: req.validated.path.id }),
  validation: {
    query: {},
    path: {
      type: "object",
      properties: { id: { type: "string", pattern: "^[a-z0-9][a-z0-9-]{0,63}$" } },
      required: ["id"],
      additionalProperties: false,
    },
    body: {
      type: "object",
      properties: {
        startImmediately: { type: "boolean" },
        rconPassword: { type: "string", maxLength: 64 },
      },
      additionalProperties: false,
    },
  },
  docs: { tags: ["Managed resources"], description: "Adopt retained volumes using their previous server ID." },
  middlewares: [checkAuth],
  entryPoint: async (req, res) =>
    res.jsonOk(201, "SERVER_RECOVERED", await recoverManagedResource(req.validated.path.id, req.validated.body)),
};
