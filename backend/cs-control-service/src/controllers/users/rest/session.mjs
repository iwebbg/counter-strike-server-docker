import checkAuth from "../../../middlewares/checkAuth.mjs";

export default {
  route: "/v1/users/session",
  method: "GET",
  bearerAuth: true,
  validation: { query: {}, path: {}, body: {} },
  docs: { tags: ["Users"], description: "Return the current authenticated operator." },
  middlewares: [checkAuth],
  entryPoint: async (req, res) => res.jsonOk(200, "SUCCESS", { user: req.user }),
};
