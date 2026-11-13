import crypto from "node:crypto";
import checkAuth from "../../../middlewares/checkAuth.mjs";
import { getServerConfiguration } from "../../servers/services/ServersService.mjs";
import { updateServerWithHistory } from "../services/ConfigurationHistoryService.mjs";

export default {
  route: "/servers/:id/rcon/rotate",
  method: "POST",
  bearerAuth: true,
  permission: "servers.manage",
  audit: (req) => ({ action: "server.rcon.rotate", targetType: "server", serverId: req.validated.path.id }),
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
  docs: { tags: ["Configuration"], description: "Rotate RCON and return the new secret exactly once." },
  middlewares: [checkAuth],
  entryPoint: async (req, res) => {
    const password = crypto.randomBytes(24).toString("base64url");
    const configuration = await getServerConfiguration(req.validated.path.id);
    const result = await updateServerWithHistory(
      req.validated.path.id,
      { ...configuration, rconPassword: password, serverPassword: "", clearServerPassword: false },
      req.user,
      "rcon-rotation",
    );
    return res.jsonOk(200, "RCON_ROTATED", { ...result, rconPassword: password, shownOnce: true });
  },
};
