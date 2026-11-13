import checkAuth from "../../../middlewares/checkAuth.mjs";
import { rollbackConfiguration } from "../services/ConfigurationHistoryService.mjs";

export default {
  route: "/servers/:id/configuration-history/:revision/rollback",
  method: "POST",
  bearerAuth: true,
  permission: "servers.manage",
  audit: (req) => ({
    action: "configuration.rollback",
    targetType: "server",
    serverId: req.validated.path.id,
    metadata: { revision: req.validated.path.revision },
  }),
  validation: {
    query: {},
    path: {
      type: "object",
      properties: {
        id: { type: "string", pattern: "^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}$" },
        revision: { type: "string", pattern: "^[1-9][0-9]*$" },
      },
      required: ["id", "revision"],
      additionalProperties: false,
    },
    body: {},
  },
  docs: { tags: ["Configuration"], description: "Rollback through the validated recreate workflow." },
  middlewares: [checkAuth],
  entryPoint: async (req, res) =>
    res.jsonOk(
      200,
      "CONFIGURATION_ROLLED_BACK",
      await rollbackConfiguration(req.validated.path.id, Number(req.validated.path.revision), req.user),
    ),
};
