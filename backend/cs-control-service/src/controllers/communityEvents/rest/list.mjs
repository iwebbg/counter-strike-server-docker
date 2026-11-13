import { PERMISSIONS } from "../../../auth/permissions.mjs";
import checkAuth from "../../../middlewares/checkAuth.mjs";
import { listCommunityEvents } from "../services/CommunityEventService.mjs";

export default {
  route: "/community-events",
  method: "GET",
  bearerAuth: true,
  permission: PERMISSIONS.SERVERS_MANAGE,
  validation: { query: {}, path: {}, body: {} },
  docs: { tags: ["Community events"], description: "List weekly scheduled community events." },
  middlewares: [checkAuth],
  entryPoint: async (_req, res) => res.jsonOk(200, "SUCCESS", { events: await listCommunityEvents() }),
};
