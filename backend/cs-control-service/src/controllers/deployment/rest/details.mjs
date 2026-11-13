import checkAuth from "../../../middlewares/checkAuth.mjs";
import { deploymentConfiguration } from "../services/DeploymentService.mjs";

export default {
  route: "/deployment/configuration",
  method: "GET",
  bearerAuth: true,
  permission: "servers.manage",
  validation: { query: {}, path: {}, body: {} },
  docs: { tags: ["Deployment"], description: "Read the safe deployment configuration allowlist." },
  middlewares: [checkAuth],
  entryPoint: async (req, res) => res.jsonOk(200, "SUCCESS", deploymentConfiguration()),
};
