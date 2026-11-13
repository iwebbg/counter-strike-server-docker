import checkAuth from "../../../middlewares/checkAuth.mjs";
import { listMapPackages } from "../services/MapPackageService.mjs";

export default {
  route: "/servers/:id/map-packages",
  method: "GET",
  bearerAuth: true,
  permission: "servers.manage",
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
  docs: { tags: ["Maps"], description: "List persistent custom map packages for one server." },
  middlewares: [checkAuth],
  entryPoint: async (req, res) => res.jsonOk(200, "SUCCESS", await listMapPackages(req.validated.path.id)),
};
