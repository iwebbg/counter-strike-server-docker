import checkAuth from "../../../middlewares/checkAuth.mjs";
import { updateServer } from "../services/ServersService.mjs";

export default {
  route: "/servers/:id",
  method: "PUT",
  bearerAuth: true,
  permission: "servers.manage",
  audit: (req) => ({ action: "server.update", targetType: "server", serverId: req.validated.path.id }),
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
        name: { type: "string", minLength: 2, maxLength: 48 },
        mode: { type: "string", enum: ["classic", "gungame"] },
        maxPlayers: { type: "integer", minimum: 2, maximum: 32 },
        startMap: { type: "string", pattern: "^[a-zA-Z0-9_]+$" },
        maps: {
          type: "array",
          minItems: 1,
          maxItems: 128,
          items: { type: "string", pattern: "^[a-zA-Z0-9_]+$" },
        },
        port: { anyOf: [{ type: "integer" }, { type: "null" }, { type: "string", maxLength: 5 }] },
        rconPassword: { type: "string", maxLength: 64 },
        serverPassword: { type: "string", maxLength: 64 },
        clearServerPassword: { type: "boolean" },
      },
      required: ["name", "mode", "maxPlayers", "startMap", "maps"],
      additionalProperties: false,
    },
  },
  docs: {
    tags: ["Servers"],
    description: "Recreate a panel-managed server with updated settings while preserving its volumes.",
  },
  middlewares: [checkAuth],
  entryPoint: async (req, res) =>
    res.jsonOk(200, "SERVER_UPDATED", await updateServer(req.validated.path.id, req.validated.body)),
};
