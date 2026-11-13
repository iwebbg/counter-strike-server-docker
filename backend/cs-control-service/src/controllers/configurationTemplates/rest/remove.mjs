import checkAuth from "../../../middlewares/checkAuth.mjs";
import { removeTemplate } from "../services/ConfigurationTemplateService.mjs";

export default {
  route: "/configuration-templates/:id",
  method: "DELETE",
  bearerAuth: true,
  permission: "servers.manage",
  audit: (req) => ({
    action: "configuration.template.delete",
    targetType: "configuration-template",
    targetId: req.validated.path.id,
  }),
  validation: {
    query: {},
    path: {
      type: "object",
      properties: { id: { type: "string", format: "uuid" } },
      required: ["id"],
      additionalProperties: false,
    },
    body: {},
  },
  docs: { tags: ["Configuration"], description: "Delete a server configuration template." },
  middlewares: [checkAuth],
  entryPoint: async (req, res) =>
    res.jsonOk(200, "CONFIGURATION_TEMPLATE_DELETED", await removeTemplate(req.validated.path.id)),
};
