import checkAuth from "../../../middlewares/checkAuth.mjs";
import { updateServerWithHistory } from "../../configurationHistory/services/ConfigurationHistoryService.mjs";
import { editableConfigurationSchema } from "../services/configurationSchema.mjs";

export default {
  route: "/servers/:id",
  method: "PUT",
  bearerAuth: true,
  permission: "servers.manage",
  audit: (req) => ({ action: "server.update", targetType: "server", serverId: req.validated.path.id }),
  validation: {
    query: {},
    path: {
      type: "object",
      properties: { id: { type: "string", pattern: "^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}$" } },
      required: ["id"],
      additionalProperties: false,
    },
    body: editableConfigurationSchema,
  },
  docs: {
    tags: ["Servers"],
    description: "Recreate a panel-managed server with updated settings while preserving its volumes.",
  },
  middlewares: [checkAuth],
  entryPoint: async (req, res) =>
    res.jsonOk(
      200,
      "SERVER_UPDATED",
      await updateServerWithHistory(req.validated.path.id, req.validated.body, req.user),
    ),
};
