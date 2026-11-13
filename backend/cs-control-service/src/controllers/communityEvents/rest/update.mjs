import { PERMISSIONS } from "../../../auth/permissions.mjs";
import checkAuth from "../../../middlewares/checkAuth.mjs";
import { updateCommunityEvent } from "../services/CommunityEventService.mjs";
import { eventIdPath, eventProperties } from "../services/schema.mjs";

export default {
  route: "/community-events/:id",
  method: "PUT",
  bearerAuth: true,
  permission: PERMISSIONS.SERVERS_MANAGE,
  audit: (req) => ({
    action: "community-event.update",
    targetType: "community-event",
    targetId: req.validated.path.id,
  }),
  validation: {
    query: {},
    path: eventIdPath,
    body: { type: "object", properties: eventProperties, minProperties: 1, additionalProperties: false },
  },
  docs: { tags: ["Community events"], description: "Update a weekly scheduled community event." },
  middlewares: [checkAuth],
  entryPoint: async (req, res) =>
    res.jsonOk(200, "COMMUNITY_EVENT_UPDATED", await updateCommunityEvent(req.validated.path.id, req.validated.body)),
};
