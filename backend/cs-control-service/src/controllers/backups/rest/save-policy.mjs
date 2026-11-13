import checkAuth from "../../../middlewares/checkAuth.mjs";
import { saveBackupPolicy } from "../services/BackupPolicyService.mjs";

export default {
  route: "/servers/:id/backup-policy",
  method: "PUT",
  bearerAuth: true,
  permission: "backups.manage",
  audit: (req) => ({ action: "backup.policy.update", targetType: "server", serverId: req.validated.path.id }),
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
        enabled: { type: "boolean" },
        intervalHours: { type: "integer", minimum: 1, maximum: 720 },
        retentionCount: { type: "integer", minimum: 1, maximum: 100 },
        includeLogs: { type: "boolean" },
        includeDatabase: { type: "boolean" },
        remoteEnabled: { type: "boolean" },
      },
      required: ["enabled", "intervalHours", "retentionCount", "includeLogs", "includeDatabase", "remoteEnabled"],
      additionalProperties: false,
    },
  },
  docs: { tags: ["Backups"], description: "Create or update an automatic backup policy." },
  middlewares: [checkAuth],
  entryPoint: async (req, res) =>
    res.jsonOk(200, "BACKUP_POLICY_SAVED", await saveBackupPolicy(req.validated.path.id, req.validated.body)),
};
