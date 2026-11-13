import checkAuth from "../../../middlewares/checkAuth.mjs";
import Db from "../../../utils/Db.mjs";
import { createSeason } from "../services/StatsService.mjs";
export default {
  route: "/seasons",
  method: "POST",
  bearerAuth: true,
  permission: "seasons.manage",
  audit: (req) => ({ action: "season.create", targetType: "season", targetName: req.validated.body.name }),
  validation: {
    query: {},
    path: {},
    body: {
      type: "object",
      properties: { name: { type: "string", minLength: 2, maxLength: 64 } },
      required: ["name"],
      additionalProperties: false,
    },
  },
  docs: { tags: ["Stats"], description: "Create and activate a ranking season." },
  middlewares: [checkAuth],
  entryPoint: async (req, res) => res.jsonOk(201, "SEASON_CREATED", await createSeason(new Db(), req.validated.body)),
};
