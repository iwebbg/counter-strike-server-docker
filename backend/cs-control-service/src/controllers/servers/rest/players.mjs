import checkAuth from "../../../middlewares/checkAuth.mjs";
import { getPlayers } from "../services/ServersService.mjs";
export default {
  route: "/servers/:id/players",
  method: "GET",
  bearerAuth: true,
  permission: "servers.read",
  validation: {
    query: {},
    path: {
      type: "object",
      properties: { id: { type: "string", pattern: "^[a-f0-9]{12,64}$" } },
      required: ["id"],
      additionalProperties: false,
    },
    body: {},
  },
  docs: { tags: ["Servers"], description: "List connected players." },
  middlewares: [checkAuth],
  entryPoint: async (req, res) => res.jsonOk(200, "SUCCESS", await getPlayers(req.validated.path.id)),
};
