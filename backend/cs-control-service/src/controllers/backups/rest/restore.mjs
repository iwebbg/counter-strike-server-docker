import checkAuth from "../../../middlewares/checkAuth.mjs";
import { restoreServerBackup } from "../services/BackupService.mjs";

export default {
  route: "/servers/:id/backups/:filename/restore",
  method: "POST",
  bearerAuth: true,
  validation: {
    query: {},
    path: {
      type: "object",
      properties: {
        id: { type: "string", pattern: "^[a-f0-9]{12,64}$" },
        filename: { type: "string", pattern: "^[a-zA-Z0-9_.-]+\\.cs16-backup\\.tar\\.gz$" },
      },
      required: ["id", "filename"],
      additionalProperties: false,
    },
    body: {
      type: "object",
      properties: { restoreLogs: { type: "boolean" }, restoreDatabase: { type: "boolean" } },
      additionalProperties: false,
    },
  },
  docs: { tags: ["Backups"], description: "Restore a backup after creating an automatic safety backup." },
  middlewares: [checkAuth],
  entryPoint: async (req, res) =>
    res.jsonOk(
      200,
      "BACKUP_RESTORED",
      await restoreServerBackup(req.validated.path.id, req.validated.path.filename, req.validated.body),
    ),
};
