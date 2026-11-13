import checkAuth from "../../../middlewares/checkAuth.mjs";
import { changeMap } from "../../servers/services/ServersService.mjs";
export default {
  route: "/servers/:id/maps/change",
  method: "POST",
  bearerAuth: true,
  permission: "maps.manage",
  audit: (req) => ({
    action: "map.change",
    targetType: "map",
    targetName: req.validated.body.map,
    serverId: req.validated.path.id,
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
      properties: { map: { type: "string", pattern: "^[a-zA-Z0-9_]+$" } },
      required: ["map"],
      additionalProperties: false,
    },
  },
  docs: { tags: ["Maps"], description: "Change the running map through RCON." },
  middlewares: [checkAuth],
  entryPoint: async (req, res) =>
    res.jsonOk(200, "MAP_CHANGING", await changeMap(req.validated.path.id, req.validated.body.map)),
};
