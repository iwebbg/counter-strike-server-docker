import checkAuth from "../../../middlewares/checkAuth.mjs";
import { serverLogs } from "../services/ServersService.mjs";
export default { route: "/servers/:id/logs", method: "GET", bearerAuth: true, validation: { query: {}, path: { type: "object", properties: { id: { type: "string", pattern: "^[a-f0-9]{12,64}$" } }, required: ["id"], additionalProperties: false }, body: {} }, docs: { tags: ["Servers"], description: "Read recent server logs." }, middlewares: [checkAuth], entryPoint: async (req, res) => res.jsonOk(200, "SUCCESS", await serverLogs(req.validated.path.id)) };
