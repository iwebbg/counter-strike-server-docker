import checkAuth from "../../../middlewares/checkAuth.mjs";
import { createEvidenceMarker } from "../services/EvidenceMarkerService.mjs";

export default {
  route: "/servers/:id/evidence/markers",
  method: "POST",
  bearerAuth: true,
  permission: "moderation.manage",
  audit: (req) => ({
    action: "evidence.marker.create",
    category: "moderation",
    targetType: "player",
    targetId: req.validated.body.steamId,
    targetName: req.validated.body.playerName,
    serverId: req.validated.path.id,
    metadata: { filename: req.validated.body.filename || null, reason: req.validated.body.reason },
  }),
  validation: {
    query: {},
    path: {
      type: "object",
      properties: { id: { type: "string", pattern: "^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}$" } },
      required: ["id"],
      additionalProperties: false,
    },
    body: {
      type: "object",
      properties: {
        steamId: { type: "string", pattern: "^STEAM_[0-9]+:[01]:[0-9]+$" },
        playerName: { type: "string", minLength: 1, maxLength: 64 },
        reason: { type: "string", minLength: 3, maxLength: 255 },
        filename: { type: "string", pattern: "^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,120}\\.dem$" },
      },
      required: ["steamId", "playerName", "reason"],
      additionalProperties: false,
    },
  },
  docs: { tags: ["Evidence"], description: "Mark a suspicious player at the current demo offset." },
  middlewares: [checkAuth],
  entryPoint: async (req, res) =>
    res.jsonOk(
      201,
      "EVIDENCE_MARKER_CREATED",
      await createEvidenceMarker(req.validated.path.id, req.validated.body, req.user),
    ),
};
