import checkAuth from "../../../middlewares/checkAuth.mjs";
import { editableConfigurationSchema } from "../../servers/services/configurationSchema.mjs";
import { createTemplate } from "../services/ConfigurationTemplateService.mjs";

export default {
  route: "/configuration-templates",
  method: "POST",
  bearerAuth: true,
  permission: "servers.manage",
  audit: (req) => ({
    action: "configuration.template.create",
    targetType: "configuration-template",
    targetName: req.validated.body.name,
  }),
  validation: {
    query: {},
    path: {},
    body: {
      type: "object",
      properties: {
        name: { type: "string", minLength: 2, maxLength: 96 },
        description: { type: "string", maxLength: 255 },
        configuration: editableConfigurationSchema,
      },
      required: ["name", "configuration"],
      additionalProperties: false,
    },
  },
  docs: { tags: ["Configuration"], description: "Create a reusable validated server template." },
  middlewares: [checkAuth],
  entryPoint: async (req, res) =>
    res.jsonOk(201, "CONFIGURATION_TEMPLATE_CREATED", await createTemplate(req.validated.body, req.user)),
};
