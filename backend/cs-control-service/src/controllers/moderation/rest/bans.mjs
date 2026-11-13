import checkAuth from "../../../middlewares/checkAuth.mjs";
import Db from "../../../utils/Db.mjs";
import { activeBans } from "../../stats/services/StatsService.mjs";
export default {
  route: "/bans",
  method: "GET",
  bearerAuth: true,
  permission: "stats.read",
  validation: { query: {}, path: {}, body: {} },
  docs: { tags: ["Moderation"], description: "Return active database bans." },
  middlewares: [checkAuth],
  entryPoint: async (req, res) => res.jsonOk(200, "SUCCESS", { bans: await activeBans(new Db()) }),
};
