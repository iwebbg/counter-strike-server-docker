import { PERMISSIONS } from "../../../auth/permissions.mjs";
import checkAuth from "../../../middlewares/checkAuth.mjs";
import { deleteCommunityEvent } from "../services/CommunityEventService.mjs";
import { eventIdPath } from "../services/schema.mjs";

export default {
  route: "/community-events/:id",
  method: "DELETE",
  bearerAuth: true,
  permission: PERMISSIONS.SERVERS_MANAGE,
  audit: (req) => ({
    action: "community-event.delete",
    targetType: "community-event",
    targetId: req.validated.path.id,
  }),
  validation: { query: {}, path: eventIdPath, body: {} },
  docs: { tags: ["Community events"], description: "Delete a scheduled community event." },
  middlewares: [checkAuth],
  entryPoint: async (req, res) =>
    res.jsonOk(200, "COMMUNITY_EVENT_DELETED", await deleteCommunityEvent(req.validated.path.id)),
};
