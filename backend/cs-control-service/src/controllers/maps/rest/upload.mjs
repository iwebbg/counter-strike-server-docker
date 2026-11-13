import checkAuth from "../../../middlewares/checkAuth.mjs";
import { uploadExtractedPackage } from "../services/MapPackageService.mjs";

export default {
  route: "/servers/:id/maps/upload",
  method: "POST",
  bearerAuth: true,
  permission: "servers.manage",
  audit: (req) => ({
    action: "map.package.upload",
    targetType: "server",
    serverId: req.validated.path.id,
    metadata: { files: req.validated.body.files?.length || 0, source: "folder" },
  }),
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
      properties: {
        mode: { type: "string", enum: ["classic", "gungame"] },
        files: {
          type: "array",
          minItems: 1,
          maxItems: 128,
          items: {
            type: "object",
            properties: {
              path: { type: "string", minLength: 1, maxLength: 256 },
              content: { type: "string", minLength: 1, maxLength: 45_000_000 },
            },
            required: ["path", "content"],
            additionalProperties: false,
          },
        },
      },
      required: ["mode", "files"],
      additionalProperties: false,
    },
  },
  docs: { tags: ["Maps"], description: "Validate and persist a custom map package for one server." },
  middlewares: [checkAuth],
  entryPoint: async (req, res) =>
    res.jsonOk(201, "MAP_PACKAGE_UPLOADED", await uploadExtractedPackage(req.validated.path.id, req.validated.body)),
};
