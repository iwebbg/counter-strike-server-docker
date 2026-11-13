import checkAuth from "../../../middlewares/checkAuth.mjs";
import { startEvidence } from "../services/EvidenceService.mjs";

export default {
  route: "/servers/:id/evidence/start",
  method: "POST",
  bearerAuth: true,
  permission: "moderation.manage",
  audit: (req) => ({
    action: "evidence.start",
    category: "moderation",
    targetType: "server",
    serverId: req.validated.path.id,
  }),
  validation: {
    query: {},
    path: {
      type: "object",
      properties: { id: { type: "string", pattern: "^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}$" } },
      required: ["id"],
      additionalProperties: false,
    },
    body: { type: "object", additionalProperties: false },
  },
  docs: { tags: ["Evidence"], description: "Start a persistent HLTV evidence recording." },
  middlewares: [checkAuth],
  entryPoint: async (req, res) =>
    res.jsonOk(201, "EVIDENCE_RECORDING_STARTED", await startEvidence(req.validated.path.id)),
};
