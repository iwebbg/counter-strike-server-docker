import checkAuth from "../../../middlewares/checkAuth.mjs";
import { createServerBackup } from "../services/BackupService.mjs";

export default {
  route: "/servers/:id/backups",
  method: "POST",
  bearerAuth: true,
  permission: "backups.manage",
  audit: (req) => ({ action: "backup.create", targetType: "server", serverId: req.validated.path.id }),
  validation: {
    query: {},
    path: {
      type: "object",
      properties: { id: { type: "string", pattern: "^[a-f0-9]{12,64}$" } },
      required: ["id"],
      additionalProperties: false,
    },
    body: {
      type: "object",
      properties: { includeLogs: { type: "boolean" }, includeDatabase: { type: "boolean" } },
      additionalProperties: false,
    },
  },
  docs: { tags: ["Backups"], description: "Create a persistent versioned server backup." },
  middlewares: [checkAuth],
  entryPoint: async (req, res) =>
    res.jsonOk(201, "BACKUP_CREATED", await createServerBackup(req.validated.path.id, req.validated.body)),
};
