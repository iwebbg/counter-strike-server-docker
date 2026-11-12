import checkAuth from "../../../middlewares/checkAuth.mjs";
import Db from "../../../utils/Db.mjs";
export default { route: "/database/status", method: "GET", bearerAuth: true, validation: { query: {}, path: {}, body: {} }, docs: { tags: ["Stats"], description: "Return MariaDB connectivity." }, middlewares: [checkAuth], entryPoint: async (req, res) => res.jsonOk(200, "SUCCESS", await new Db().status()) };
