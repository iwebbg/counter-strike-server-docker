import checkAuth from "../../../middlewares/checkAuth.mjs";
import { configurationDocumentSchema } from "../../servers/services/configurationSchema.mjs";
import { importConfiguration } from "../services/ConfigurationOperationsService.mjs";

export default {
  route: "/servers/import",
  method: "POST",
  bearerAuth: true,
  permission: "servers.manage",
  audit: (req) => ({ action: "configuration.import", targetType: "server", targetName: req.validated.body.name }),
  validation: {
    query: {},
    path: {},
    body: {
      type: "object",
      properties: {
        document: configurationDocumentSchema,
        name: { type: "string", minLength: 2, maxLength: 48 },
        port: { anyOf: [{ type: "integer" }, { type: "null" }] },
        startImmediately: { type: "boolean" },
      },
      required: ["document", "name"],
      additionalProperties: false,
    },
  },
  docs: { tags: ["Configuration"], description: "Validate and deploy a versioned server configuration document." },
  middlewares: [checkAuth],
  entryPoint: async (req, res) =>
    res.jsonOk(
      201,
      "CONFIGURATION_IMPORTED",
      await importConfiguration(req.validated.body.document, req.validated.body),
    ),
};
