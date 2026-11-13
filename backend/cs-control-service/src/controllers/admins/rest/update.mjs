import checkAuth from "../../../middlewares/checkAuth.mjs";
import { updateAdmins } from "../../servers/services/ServersService.mjs";
export default {
  route: "/servers/:id/admins",
  method: "PUT",
  bearerAuth: true,
  permission: "admins.manage",
  audit: (req) => ({ action: "admins.update", targetType: "server", serverId: req.validated.path.id }),
  validation: {
    query: {},
    path: {
      type: "object",
      properties: { id: { type: "string", pattern: "^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}$" } },
      required: ["id"],
      additionalProperties: false,
    },
    body: {
      type: "object",
      properties: {
        scope: { type: "string", enum: ["server", "fleet"] },
        admins: {
          type: "array",
          maxItems: 32,
          items: {
            type: "object",
            properties: { steamId: { type: "string" }, flags: { type: "string" } },
            required: ["steamId", "flags"],
            additionalProperties: false,
          },
        },
      },
      required: ["admins"],
      additionalProperties: false,
    },
  },
  docs: { tags: ["Admins"], description: "Persist and live-reload AMXX admins." },
  middlewares: [checkAuth],
  entryPoint: async (req, res) =>
    res.jsonOk(200, "ADMINS_UPDATED", await updateAdmins(req.validated.path.id, req.validated.body)),
};
