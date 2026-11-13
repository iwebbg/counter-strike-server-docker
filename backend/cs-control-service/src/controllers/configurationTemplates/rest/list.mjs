import checkAuth from "../../../middlewares/checkAuth.mjs";
import { listTemplates } from "../services/ConfigurationTemplateService.mjs";

export default {
  route: "/configuration-templates",
  method: "GET",
  bearerAuth: true,
  permission: "servers.manage",
  validation: { query: {}, path: {}, body: {} },
  docs: { tags: ["Configuration"], description: "List reusable server configuration templates." },
  middlewares: [checkAuth],
  entryPoint: async (req, res) => res.jsonOk(200, "SUCCESS", { templates: await listTemplates() }),
};
