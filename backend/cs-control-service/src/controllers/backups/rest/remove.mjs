import checkAuth from "../../../middlewares/checkAuth.mjs";
import { deleteBackup } from "../services/BackupService.mjs";

export default {
  route: "/backups/:filename",
  method: "DELETE",
  bearerAuth: true,
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
  docs: { tags: ["Backups"], description: "Delete one stored backup archive." },
  middlewares: [checkAuth],
  entryPoint: async (req, res) => res.jsonOk(200, "BACKUP_DELETED", await deleteBackup(req.validated.path.filename)),
};
