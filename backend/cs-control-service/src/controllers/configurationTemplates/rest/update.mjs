import checkAuth from "../../../middlewares/checkAuth.mjs";
import { editableConfigurationSchema } from "../../servers/services/configurationSchema.mjs";
import { updateTemplate } from "../services/ConfigurationTemplateService.mjs";

export default {
  route: "/configuration-templates/:id",
  method: "PUT",
  bearerAuth: true,
  permission: "servers.manage",
  audit: (req) => ({
    action: "configuration.template.update",
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
    body: {
      type: "object",
      properties: {
        name: { type: "string", minLength: 2, maxLength: 96 },
        description: { type: "string", maxLength: 255 },
        configuration: editableConfigurationSchema,
      },
      minProperties: 1,
      additionalProperties: false,
    },
  },
  docs: { tags: ["Configuration"], description: "Update a reusable server template." },
  middlewares: [checkAuth],
  entryPoint: async (req, res) =>
    res.jsonOk(200, "CONFIGURATION_TEMPLATE_UPDATED", await updateTemplate(req.validated.path.id, req.validated.body)),
};
