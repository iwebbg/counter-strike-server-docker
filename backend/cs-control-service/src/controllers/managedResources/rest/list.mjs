import checkAuth from "../../../middlewares/checkAuth.mjs";
import { listManagedResources } from "../services/ManagedResourceService.mjs";

export default {
  route: "/managed-resources",
  method: "GET",
  bearerAuth: true,
  permission: "servers.manage",
  validation: { query: {}, path: {}, body: {} },
  docs: { tags: ["Managed resources"], description: "Inventory retained CS server definitions and volumes." },
  middlewares: [checkAuth],
  entryPoint: async (req, res) => res.jsonOk(200, "SUCCESS", await listManagedResources()),
};
