import checkAuth from "../../../middlewares/checkAuth.mjs";
import { serverAction } from "../services/ServersService.mjs";
export default {
  route: "/servers/:id/:action",
  method: "POST",
  bearerAuth: true,
  validation: {
    query: {},
    path: {
      type: "object",
      properties: {
        id: { type: "string", pattern: "^[a-f0-9]{12,64}$" },
        action: { type: "string", enum: ["start", "stop", "restart"] },
      },
      required: ["id", "action"],
      additionalProperties: false,
    },
    body: {},
  },
  docs: { tags: ["Servers"], description: "Start, stop or restart a server." },
  middlewares: [checkAuth],
  entryPoint: async (req, res) =>
    res.jsonOk(200, "SUCCESS", await serverAction(req.validated.path.id, req.validated.path.action)),
};
