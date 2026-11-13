import checkAuth from "../../../middlewares/checkAuth.mjs";
import { listEvidenceMarkers } from "../services/EvidenceMarkerService.mjs";

export default {
  route: "/servers/:id/evidence/markers",
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
  docs: { tags: ["Evidence"], description: "List suspicious-player markers attached to HLTV evidence." },
  middlewares: [checkAuth],
  entryPoint: async (req, res) =>
    res.jsonOk(200, "SUCCESS", { markers: await listEvidenceMarkers(req.validated.path.id) }),
};
