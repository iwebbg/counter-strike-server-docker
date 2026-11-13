import checkAuth from "../../../middlewares/checkAuth.mjs";
import { deleteMapPackage } from "../services/MapPackageService.mjs";

export default {
  route: "/servers/:id/map-packages/:packageId",
  method: "DELETE",
  bearerAuth: true,
  permission: "servers.manage",
  audit: (req) => ({
    action: "map.package.delete",
    targetType: "map-package",
    targetId: req.validated.path.packageId,
    serverId: req.validated.path.id,
  }),
  validation: {
    query: {},
    path: {
      type: "object",
      properties: {
        id: { type: "string", pattern: "^[a-f0-9]{12,64}$" },
        packageId: { type: "string", format: "uuid" },
      },
      required: ["id", "packageId"],
      additionalProperties: false,
    },
    body: {},
  },
  docs: { tags: ["Maps"], description: "Delete a managed map package when it is not active or in rotation." },
  middlewares: [checkAuth],
  entryPoint: async (req, res) =>
    res.jsonOk(200, "MAP_PACKAGE_DELETED", await deleteMapPackage(req.validated.path.id, req.validated.path.packageId)),
};
