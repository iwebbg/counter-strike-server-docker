import checkAuth from "../../../middlewares/checkAuth.mjs";
import { getMaps } from "../../servers/services/ServersService.mjs";
export default { route: "/servers/:id/maps", method: "GET", bearerAuth: true, validation: { query: {}, path: { type: "object", properties: { id: { type: "string", pattern: "^[a-f0-9]{12,64}$" } }, required: ["id"], additionalProperties: false }, body: {} }, docs: { tags: ["Maps"], description: "Read the mode-specific map rotation." }, middlewares: [checkAuth], entryPoint: async (req, res) => res.jsonOk(200, "SUCCESS", await getMaps(req.validated.path.id)) };
