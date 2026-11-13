import checkAuth from "../../../middlewares/checkAuth.mjs";
import { updateMaps } from "../../servers/services/ServersService.mjs";
export default {
  route: "/servers/:id/maps",
  method: "PUT",
  bearerAuth: true,
  permission: "maps.manage",
  audit: (req) => ({ action: "map.rotation.update", targetType: "server", serverId: req.validated.path.id }),
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
        maps: { type: "array", minItems: 1, maxItems: 128, items: { type: "string", pattern: "^[a-zA-Z0-9_]+$" } },
      },
      required: ["maps"],
      additionalProperties: false,
    },
  },
  docs: { tags: ["Maps"], description: "Persist the mode-specific map rotation." },
  middlewares: [checkAuth],
  entryPoint: async (req, res) =>
    res.jsonOk(200, "MAPS_UPDATED", await updateMaps(req.validated.path.id, req.validated.body)),
};
