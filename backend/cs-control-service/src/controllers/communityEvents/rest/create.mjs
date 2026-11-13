import { PERMISSIONS } from "../../../auth/permissions.mjs";
import checkAuth from "../../../middlewares/checkAuth.mjs";
import { createCommunityEvent } from "../services/CommunityEventService.mjs";
import { eventProperties } from "../services/schema.mjs";

export default {
  route: "/community-events",
  method: "POST",
  bearerAuth: true,
  permission: PERMISSIONS.SERVERS_MANAGE,
  audit: (req) => ({ action: "community-event.create", targetType: "server", serverId: req.validated.body.serverId }),
  validation: {
    query: {},
    path: {},
    body: {
      type: "object",
      properties: eventProperties,
      required: ["name", "serverId", "dayOfWeek", "startTime", "timezone", "durationMinutes", "enabled"],
      additionalProperties: false,
    },
  },
  docs: { tags: ["Community events"], description: "Create a weekly scheduled community event." },
  middlewares: [checkAuth],
  entryPoint: async (req, res) =>
    res.jsonOk(201, "COMMUNITY_EVENT_CREATED", await createCommunityEvent(req.validated.body, req.user.id)),
};
