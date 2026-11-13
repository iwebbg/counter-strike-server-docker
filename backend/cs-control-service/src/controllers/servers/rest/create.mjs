import checkAuth from "../../../middlewares/checkAuth.mjs";
import { createServer } from "../services/ServersService.mjs";

export default {
  route: "/servers",
  method: "POST",
  bearerAuth: true,
  permission: "servers.manage",
  audit: (req) => ({ action: "server.create", targetType: "server", targetName: req.validated.body.name }),
  validation: {
    query: {},
    path: {},
    body: {
      type: "object",
      properties: {
        name: { type: "string", minLength: 2, maxLength: 48 },
        mode: { type: "string", enum: ["classic", "gungame"] },
        maxPlayers: { type: "integer", minimum: 2, maximum: 32 },
        startMap: { type: "string", pattern: "^[a-zA-Z0-9_]+$" },
        maps: { type: "array", minItems: 1, maxItems: 128, items: { type: "string", pattern: "^[a-zA-Z0-9_]+$" } },
        port: { anyOf: [{ type: "integer" }, { type: "null" }, { type: "string", maxLength: 5 }] },
        rconPassword: { type: "string", maxLength: 64 },
        serverPassword: { type: "string", maxLength: 64 },
        adminSteamIds: { type: "string", maxLength: 1600 },
        startImmediately: { type: "boolean" },
      },
      required: ["name", "mode", "maxPlayers"],
      additionalProperties: false,
    },
  },
  docs: { tags: ["Servers"], description: "Create a controlled CS server." },
  middlewares: [checkAuth],
  entryPoint: async (req, res) => res.jsonOk(201, "SERVER_CREATED", await createServer(req.validated.body)),
};
