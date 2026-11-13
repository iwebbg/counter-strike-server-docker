import checkAuth from "../../../middlewares/checkAuth.mjs";
import { runBackupPolicy } from "../services/BackupPolicyService.mjs";

export default {
  route: "/servers/:id/backup-policy/run",
  method: "POST",
  bearerAuth: true,
  permission: "backups.manage",
  audit: (req) => ({ action: "backup.policy.run", targetType: "server", serverId: req.validated.path.id }),
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
  docs: { tags: ["Backups"], description: "Run the configured backup policy immediately." },
  middlewares: [checkAuth],
  entryPoint: async (req, res) => res.jsonOk(201, "BACKUP_CREATED", await runBackupPolicy(req.validated.path.id)),
};
