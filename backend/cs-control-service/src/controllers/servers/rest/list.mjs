import checkAuth from "../../../middlewares/checkAuth.mjs";
import { listServers, portRange } from "../services/ServersService.mjs";

export default { route: "/servers", method: "GET", bearerAuth: true, validation: { query: {}, path: {}, body: {} }, docs: { tags: ["Servers"], description: "List controlled CS servers." }, middlewares: [checkAuth], entryPoint: async (req, res) => res.jsonOk(200, "SUCCESS", { servers: await listServers(), portRange: portRange() }) };
