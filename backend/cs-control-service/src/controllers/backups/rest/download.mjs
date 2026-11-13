import checkAuth from "../../../middlewares/checkAuth.mjs";
import { backupFile } from "../services/BackupService.mjs";

export default {
  route: "/backups/:filename/download",
  method: "GET",
  bearerAuth: true,
  permission: "backups.manage",
  audit: (req) => ({ action: "backup.download", targetType: "backup", targetId: req.validated.path.filename }),
  validation: {
    query: {},
    path: {
      type: "object",
      properties: { filename: { type: "string", pattern: "^[a-zA-Z0-9_.-]+\\.cs16-backup\\.tar\\.gz$" } },
      required: ["filename"],
      additionalProperties: false,
    },
    body: {},
  },
  docs: { tags: ["Backups"], description: "Download a stored backup archive." },
  middlewares: [checkAuth],
  entryPoint: async (req, res) => {
    const backup = await backupFile(req.validated.path.filename);
    return res.download(backup.file, backup.filename);
  },
};
