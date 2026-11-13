import checkAuth from "../../../middlewares/checkAuth.mjs";
import { exportConfiguration } from "../services/ConfigurationOperationsService.mjs";

export default {
  route: "/servers/:id/configuration/export",
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
  docs: { tags: ["Configuration"], description: "Export a safe versioned server configuration document." },
  middlewares: [checkAuth],
  entryPoint: async (req, res) => res.jsonOk(200, "SUCCESS", await exportConfiguration(req.validated.path.id)),
};
