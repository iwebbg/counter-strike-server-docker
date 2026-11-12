import checkAuth from "../../../middlewares/checkAuth.mjs";
import { listBackups } from "../services/BackupService.mjs";

export default {
  route: "/backups",
  method: "GET",
  bearerAuth: true,
  validation: {
    query: {
      type: "object",
      properties: { serverId: { type: "string", pattern: "^[a-zA-Z0-9_-]{1,64}$" } },
      additionalProperties: false,
    },
    path: {},
    body: {},
  },
  docs: { tags: ["Backups"], description: "List stored server and safety backups." },
  middlewares: [checkAuth],
  entryPoint: async (req, res) =>
    res.jsonOk(200, "SUCCESS", { backups: await listBackups(req.validated.query.serverId || null) }),
};
