import checkAuth from "../../../middlewares/checkAuth.mjs";
import { moderate } from "../../servers/services/ServersService.mjs";
export default {
  route: "/servers/:id/players/:userId/:action",
  method: "POST",
  bearerAuth: true,
  permission: "players.moderate",
  audit: (req) => ({
    action: `player.${req.validated.path.action}`,
    targetType: "player",
    targetId: req.validated.path.userId,
    serverId: req.validated.path.id,
    metadata: {
      reason: req.validated.body.reason,
      minutes: req.validated.body.minutes,
      scope: req.validated.body.scope,
    },
  }),
  validation: {
    query: {},
    path: {
      type: "object",
      properties: {
        id: { type: "string", pattern: "^[a-f0-9]{12,64}$" },
        userId: { type: "string", pattern: "^[0-9]+$" },
        action: { type: "string", enum: ["kick", "ban"] },
      },
      required: ["id", "userId", "action"],
      additionalProperties: false,
    },
    body: {
      type: "object",
      properties: {
        reason: { type: "string", maxLength: 80 },
        minutes: { type: "integer", minimum: 0, maximum: 525600 },
        scope: { type: "string", enum: ["fleet", "server"] },
      },
      additionalProperties: false,
    },
  },
  docs: { tags: ["Moderation"], description: "Kick or ban a connected player." },
  middlewares: [checkAuth],
  entryPoint: async (req, res) =>
    res.jsonOk(
      200,
      "SUCCESS",
      await moderate(req.validated.path.id, req.validated.path.userId, req.validated.path.action, req.validated.body),
    ),
};
