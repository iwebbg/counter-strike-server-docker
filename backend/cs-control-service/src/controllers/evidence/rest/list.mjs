import checkAuth from "../../../middlewares/checkAuth.mjs";
import { evidenceStatus } from "../services/EvidenceService.mjs";

export default {
  route: "/servers/:id/evidence",
  method: "GET",
  bearerAuth: true,
  permission: "moderation.manage",
  validation: {
    query: {},
    path: {
      type: "object",
      properties: { id: { type: "string", pattern: "^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}$" } },
      required: ["id"],
      additionalProperties: false,
    },
    body: {},
  },
  docs: { tags: ["Evidence"], description: "List HLTV evidence and active recording state." },
  middlewares: [checkAuth],
  entryPoint: async (req, res) => res.jsonOk(200, "SUCCESS", await evidenceStatus(req.validated.path.id)),
};
