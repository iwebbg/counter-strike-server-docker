import checkAuth from "../../../middlewares/checkAuth.mjs";
import { migrateFleetImages } from "../services/ServersService.mjs";

export default {
  route: "/fleet/server-images",
  method: "PUT",
  bearerAuth: true,
  validation: { query: {}, path: {}, body: {} },
  docs: {
    tags: ["Servers"],
    description: "Sequentially migrate every outdated panel-managed server with per-server rollback.",
  },
  middlewares: [checkAuth],
  entryPoint: async (req, res) => res.jsonOk(200, "FLEET_IMAGES_UPDATED", await migrateFleetImages()),
};
