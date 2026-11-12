import checkAuth from "../../../middlewares/checkAuth.mjs";
import Db from "../../../utils/Db.mjs";
import { moderationHistory } from "../../stats/services/StatsService.mjs";
export default {
  route: "/moderation/history",
  method: "GET",
  bearerAuth: true,
  validation: { query: {}, path: {}, body: {} },
  docs: { tags: ["Moderation"], description: "Return moderation history." },
  middlewares: [checkAuth],
  entryPoint: async (req, res) => res.jsonOk(200, "SUCCESS", { actions: await moderationHistory(new Db()) }),
};
