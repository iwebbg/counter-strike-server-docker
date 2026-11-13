import { PERMISSIONS } from "../../../auth/permissions.mjs";
import checkAuth from "../../../middlewares/checkAuth.mjs";
import { listOperators } from "../services/OperatorService.mjs";

export default {
  route: "/operators",
  method: "GET",
  bearerAuth: true,
  permission: PERMISSIONS.OPERATORS_MANAGE,
  validation: { query: {}, path: {}, body: {} },
  docs: { tags: ["Operators"], description: "List control-panel operators." },
  middlewares: [checkAuth],
  entryPoint: async (req, res) => res.jsonOk(200, "SUCCESS", { operators: await listOperators() }),
};
