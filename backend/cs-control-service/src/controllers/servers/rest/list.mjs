import checkAuth from "../../../middlewares/checkAuth.mjs";
import { listServers, portRange } from "../services/ServersService.mjs";

export default {
  route: "/servers",
  method: "GET",
  bearerAuth: true,
  permission: "servers.read",
  validation: { query: {}, path: {}, body: {} },
  docs: { tags: ["Servers"], description: "List controlled CS servers." },
  middlewares: [checkAuth],
  entryPoint: async (req, res) => {
    const scopes = Array.isArray(req.user?.serverScopes) ? req.user.serverScopes : [];
    const servers = await listServers();
    return res.jsonOk(200, "SUCCESS", {
      servers: scopes.length ? servers.filter((server) => scopes.includes(server.serverId)) : servers,
      portRange: portRange(),
    });
  },
};
