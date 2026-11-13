import checkAuth from "../../../middlewares/checkAuth.mjs";
import Db from "../../../utils/Db.mjs";
import { revokeBan } from "../../stats/services/StatsService.mjs";
export default {
  route: "/bans/:id/revoke",
  method: "POST",
  bearerAuth: true,
  permission: "moderation.manage",
  audit: (req) => ({ action: "ban.revoke", targetType: "ban", targetId: req.validated.path.id }),
  validation: {
    query: {},
    path: {
      type: "object",
      properties: { id: { type: "string", pattern: "^[0-9]+$" } },
      required: ["id"],
      additionalProperties: false,
    },
    body: {},
  },
  docs: { tags: ["Moderation"], description: "Revoke an active ban." },
  middlewares: [checkAuth],
  entryPoint: async (req, res) =>
    res.jsonOk(200, "BAN_REVOKED", await revokeBan(new Db(), Number(req.validated.path.id))),
};
