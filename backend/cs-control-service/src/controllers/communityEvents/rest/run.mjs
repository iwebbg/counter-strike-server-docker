import { PERMISSIONS } from "../../../auth/permissions.mjs";
import checkAuth from "../../../middlewares/checkAuth.mjs";
import { runCommunityEvent } from "../services/CommunityEventService.mjs";
import { eventIdPath } from "../services/schema.mjs";

export default {
  route: "/community-events/:id/run",
  method: "POST",
  bearerAuth: true,
  permission: PERMISSIONS.SERVERS_OPERATE,
  audit: (req) => ({ action: "community-event.run", targetType: "community-event", targetId: req.validated.path.id }),
  validation: { query: {}, path: eventIdPath, body: {} },
  docs: { tags: ["Community events"], description: "Start a scheduled event immediately." },
  middlewares: [checkAuth],
  entryPoint: async (req, res) =>
    res.jsonOk(200, "COMMUNITY_EVENT_STARTED", await runCommunityEvent(req.validated.path.id)),
};
