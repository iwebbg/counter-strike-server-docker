import checkAuth from "../../../middlewares/checkAuth.mjs";
import { listConfigurationHistory } from "../services/ConfigurationHistoryService.mjs";

export default {
  route: "/servers/:id/configuration-history",
  method: "GET",
  bearerAuth: true,
  permission: "servers.manage",
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
  docs: { tags: ["Configuration"], description: "List versioned server configuration snapshots." },
  middlewares: [checkAuth],
  entryPoint: async (req, res) =>
    res.jsonOk(200, "SUCCESS", { revisions: await listConfigurationHistory(req.validated.path.id) }),
};
