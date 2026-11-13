import checkAuth from "../../../middlewares/checkAuth.mjs";
import { applyTemplate } from "../services/ConfigurationOperationsService.mjs";

export default {
  route: "/servers/:id/configuration-templates/:templateId/apply",
  method: "POST",
  bearerAuth: true,
  permission: "servers.manage",
  audit: (req) => ({
    action: "configuration.template.apply",
    targetType: "server",
    serverId: req.validated.path.id,
    metadata: { templateId: req.validated.path.templateId },
  }),
  validation: {
    query: {},
    path: {
      type: "object",
      properties: {
        id: { type: "string", pattern: "^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}$" },
        templateId: { type: "string", format: "uuid" },
      },
      required: ["id", "templateId"],
      additionalProperties: false,
    },
    body: {},
  },
  docs: {
    tags: ["Configuration"],
    description: "Apply a template while preserving server identity, port, and secrets.",
  },
  middlewares: [checkAuth],
  entryPoint: async (req, res) =>
    res.jsonOk(
      200,
      "CONFIGURATION_TEMPLATE_APPLIED",
      await applyTemplate(req.validated.path.id, req.validated.path.templateId),
    ),
};
