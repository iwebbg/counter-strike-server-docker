import checkAuth from "../../../middlewares/checkAuth.mjs";
import { getBackupPolicy } from "../services/BackupPolicyService.mjs";

export default {
  route: "/servers/:id/backup-policy",
  method: "GET",
  bearerAuth: true,
  permission: "backups.manage",
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
  docs: { tags: ["Backups"], description: "Read the automatic backup policy for a server." },
  middlewares: [checkAuth],
  entryPoint: async (req, res) => res.jsonOk(200, "SUCCESS", await getBackupPolicy(req.validated.path.id)),
};
