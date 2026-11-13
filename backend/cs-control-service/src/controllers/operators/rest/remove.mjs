import { PERMISSIONS } from "../../../auth/permissions.mjs";
import checkAuth from "../../../middlewares/checkAuth.mjs";
import { deleteOperator } from "../services/OperatorService.mjs";

export default {
  route: "/operators/:id",
  method: "DELETE",
  bearerAuth: true,
  permission: PERMISSIONS.OPERATORS_MANAGE,
  audit: (req) => ({ action: "operator.delete", targetType: "operator", targetId: req.validated.path.id }),
  validation: {
    query: {},
    path: {
      type: "object",
      properties: { id: { type: "string", format: "uuid" } },
      required: ["id"],
      additionalProperties: false,
    },
    body: {},
  },
  docs: { tags: ["Operators"], description: "Delete an operator while preserving audit snapshots." },
  middlewares: [checkAuth],
  entryPoint: async (req, res) =>
    res.jsonOk(200, "OPERATOR_DELETED", await deleteOperator(req.validated.path.id, req.user.id)),
};
