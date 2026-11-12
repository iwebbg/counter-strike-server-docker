import checkAuth from "../../../middlewares/checkAuth.mjs";
import Db from "../../../utils/Db.mjs";
import { statsOverview } from "../services/StatsService.mjs";
export default { route: "/stats/overview", method: "GET", bearerAuth: true, validation: { query: { type: "object", properties: { serverId: { type: "string", pattern: "^[a-zA-Z0-9_-]{1,64}$" }, seasonId: { type: "string", pattern: "^[0-9]{1,10}$" } }, additionalProperties: false }, path: {}, body: {} }, docs: { tags: ["Stats"], description: "Return fleet statistics." }, middlewares: [checkAuth], entryPoint: async (req, res) => res.jsonOk(200, "SUCCESS", await statsOverview(new Db(), { serverId: req.validated.query.serverId ?? null, seasonId: req.validated.query.seasonId ? Number(req.validated.query.seasonId) : null })) };
