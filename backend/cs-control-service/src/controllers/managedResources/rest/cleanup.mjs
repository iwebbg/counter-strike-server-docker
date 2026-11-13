import checkAuth from "../../../middlewares/checkAuth.mjs";
import { cleanupManagedResource } from "../services/ManagedResourceService.mjs";

export default {
  route: "/managed-resources/:id",
  method: "DELETE",
  bearerAuth: true,
  permission: "servers.manage",
  audit: (req) => ({ action: "resource.cleanup", targetType: "server", serverId: req.validated.path.id }),
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
      properties: { removeVolumes: { type: "boolean" }, removeRegistry: { type: "boolean" } },
      required: ["removeVolumes", "removeRegistry"],
      additionalProperties: false,
    },
  },
  docs: { tags: ["Managed resources"], description: "Delete exact retained volumes and/or a stale registry row." },
  middlewares: [checkAuth],
  entryPoint: async (req, res) =>
    res.jsonOk(200, "RESOURCE_CLEANED", await cleanupManagedResource(req.validated.path.id, req.validated.body)),
};
