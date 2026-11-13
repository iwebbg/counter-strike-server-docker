import checkAuth from "../../../middlewares/checkAuth.mjs";
import { uploadZipPackage } from "../services/MapPackageService.mjs";

export default {
  route: "/servers/:id/map-packages/zip",
  method: "POST",
  bearerAuth: true,
  permission: "servers.manage",
  audit: (req) => ({
    action: req.validated.body.replacePackageId ? "map.package.replace" : "map.package.upload",
    targetType: "map-package",
    targetId: req.validated.body.replacePackageId,
    targetName: req.validated.body.filename,
    serverId: req.validated.path.id,
    metadata: { source: "zip", mode: req.validated.body.mode || "auto" },
  }),
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
        filename: { type: "string", minLength: 5, maxLength: 255, pattern: "\\.zip$" },
        name: { type: "string", minLength: 2, maxLength: 80 },
        mode: { type: "string", enum: ["auto", "classic", "gungame"] },
        content: { type: "string", minLength: 1, maxLength: 45_000_000 },
        replacePackageId: { type: "string", format: "uuid" },
      },
      required: ["filename", "content"],
      additionalProperties: false,
    },
  },
  docs: { tags: ["Maps"], description: "Validate and persist a ZIP map package, or replace an existing package." },
  middlewares: [checkAuth],
  entryPoint: async (req, res) =>
    res.jsonOk(201, "MAP_PACKAGE_UPLOADED", await uploadZipPackage(req.validated.path.id, req.validated.body)),
};
