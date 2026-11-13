import checkAuth from "../../../middlewares/checkAuth.mjs";
import { evidenceFile } from "../services/EvidenceService.mjs";

export default {
  route: "/servers/:id/evidence/:filename",
  method: "GET",
  bearerAuth: true,
  permission: "moderation.manage",
  audit: (req) => ({
    action: "evidence.download",
    category: "moderation",
    targetType: "evidence",
    targetId: req.validated.path.filename,
    serverId: req.validated.path.id,
  }),
  validation: {
    query: {},
    path: {
      type: "object",
      properties: {
        id: { type: "string", pattern: "^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}$" },
        filename: { type: "string", pattern: "^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,120}\\.dem$" },
      },
      required: ["id", "filename"],
      additionalProperties: false,
    },
    body: {},
  },
  docs: { tags: ["Evidence"], description: "Download a persistent HLTV demo." },
  middlewares: [checkAuth],
  entryPoint: async (req, res) => {
    const file = await evidenceFile(req.validated.path.id, req.validated.path.filename);
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
    return res.status(200).send(file.content);
  },
};
