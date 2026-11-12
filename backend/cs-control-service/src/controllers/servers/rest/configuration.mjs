import checkAuth from "../../../middlewares/checkAuth.mjs";
import { getServerConfiguration } from "../services/ServersService.mjs";

export default {
  route: "/servers/:id/configuration",
  method: "GET",
  bearerAuth: true,
  validation: {
    query: {},
    path: {
      type: "object",
      properties: { id: { type: "string", pattern: "^[a-f0-9]{12,64}$" } },
      required: ["id"],
      additionalProperties: false,
    },
    body: {},
  },
  docs: { tags: ["Servers"], description: "Read editable configuration for a panel-managed server." },
  middlewares: [checkAuth],
  entryPoint: async (req, res) => res.jsonOk(200, "SUCCESS", await getServerConfiguration(req.validated.path.id)),
};
