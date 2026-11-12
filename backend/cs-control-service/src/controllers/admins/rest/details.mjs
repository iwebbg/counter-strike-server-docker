import checkAuth from "../../../middlewares/checkAuth.mjs";
import { getAdmins } from "../../servers/services/ServersService.mjs";
export default { route: "/servers/:id/admins", method: "GET", bearerAuth: true, validation: { query: {}, path: { type: "object", properties: { id: { type: "string", pattern: "^[a-f0-9]{12,64}$" } }, required: ["id"], additionalProperties: false }, body: {} }, docs: { tags: ["Admins"], description: "Read live AMXX admins." }, middlewares: [checkAuth], entryPoint: async (req, res) => res.jsonOk(200, "SUCCESS", await getAdmins(req.validated.path.id)) };
