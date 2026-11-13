import checkAuth from "../../../middlewares/checkAuth.mjs";
import { deleteEvidenceMarker } from "../services/EvidenceMarkerService.mjs";

export default {
  route: "/servers/:id/evidence/markers/:markerId",
  method: "DELETE",
  bearerAuth: true,
  permission: "moderation.manage",
  audit: (req) => ({
    action: "evidence.marker.delete",
    category: "moderation",
    targetType: "evidence-marker",
    targetId: req.validated.path.markerId,
    serverId: req.validated.path.id,
  }),
  validation: {
    query: {},
    path: {
      type: "object",
      properties: {
        id: { type: "string", pattern: "^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}$" },
        markerId: { type: "string", pattern: "^[a-f0-9-]{36}$" },
      },
      required: ["id", "markerId"],
      additionalProperties: false,
    },
    body: {},
  },
  docs: { tags: ["Evidence"], description: "Delete an evidence marker without deleting its demo." },
  middlewares: [checkAuth],
  entryPoint: async (req, res) =>
    res.jsonOk(
      200,
      "EVIDENCE_MARKER_DELETED",
      await deleteEvidenceMarker(req.validated.path.id, req.validated.path.markerId),
    ),
};
