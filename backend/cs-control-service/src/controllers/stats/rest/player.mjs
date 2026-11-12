import checkAuth from "../../../middlewares/checkAuth.mjs";
import Db from "../../../utils/Db.mjs";
import { playerProfile } from "../services/StatsService.mjs";
export default { route: "/stats/players/:steamId", method: "GET", bearerAuth: true, validation: { query: {}, path: { type: "object", properties: { steamId: { type: "string", pattern: "^STEAM_[0-9]+:[01]:[0-9]+$" } }, required: ["steamId"], additionalProperties: false }, body: {} }, docs: { tags: ["Stats"], description: "Return a player profile." }, middlewares: [checkAuth], entryPoint: async (req, res) => res.jsonOk(200, "SUCCESS", await playerProfile(new Db(), req.validated.path.steamId)) };
