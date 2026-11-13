import checkAuth from "../../../middlewares/checkAuth.mjs";
import { reconcileManagedResource } from "../services/ManagedResourceService.mjs";

export default {
  route: "/managed-resources/:id/reconcile",
  method: "POST",
  bearerAuth: true,
  permission: "servers.manage",
  audit: (req) => ({ action: "resource.reconcile", targetType: "server", serverId: req.validated.path.id }),
  validation: {
    query: {},
    path: {
      type: "object",
      properties: { id: { type: "string", pattern: "^[a-z0-9][a-z0-9-]{0,63}$" } },
      required: ["id"],
      additionalProperties: false,
    },
    body: {},
  },
  docs: { tags: ["Managed resources"], description: "Recreate a missing server from its stored definition." },
  middlewares: [checkAuth],
  entryPoint: async (req, res) =>
    res.jsonOk(200, "SERVER_RECONCILED", await reconcileManagedResource(req.validated.path.id)),
};
