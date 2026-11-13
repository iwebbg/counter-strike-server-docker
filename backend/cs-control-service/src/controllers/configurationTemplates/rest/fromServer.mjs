import checkAuth from "../../../middlewares/checkAuth.mjs";
import { createTemplateFromServer } from "../services/ConfigurationOperationsService.mjs";

export default {
  route: "/servers/:id/configuration-templates",
  method: "POST",
  bearerAuth: true,
  permission: "servers.manage",
  audit: (req) => ({
    action: "configuration.template.capture",
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
        name: { type: "string", minLength: 2, maxLength: 96 },
        description: { type: "string", maxLength: 255 },
      },
      required: ["name"],
      additionalProperties: false,
    },
  },
  docs: { tags: ["Configuration"], description: "Capture the current server configuration as a template." },
  middlewares: [checkAuth],
  entryPoint: async (req, res) =>
    res.jsonOk(
      201,
      "CONFIGURATION_TEMPLATE_CREATED",
      await createTemplateFromServer(req.validated.path.id, req.validated.body, req.user),
    ),
};
