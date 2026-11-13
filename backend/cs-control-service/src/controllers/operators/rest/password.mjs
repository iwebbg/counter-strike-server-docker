import { PERMISSIONS } from "../../../auth/permissions.mjs";
import checkAuth from "../../../middlewares/checkAuth.mjs";
import { changeOperatorPassword } from "../services/OperatorService.mjs";

export default {
  route: "/operators/:id/password",
  method: "PUT",
  bearerAuth: true,
  permission: PERMISSIONS.OPERATORS_MANAGE,
  audit: (req) => ({ action: "operator.password", targetType: "operator", targetId: req.validated.path.id }),
  validation: {
    query: {},
    path: {
      type: "object",
      properties: { id: { type: "string", format: "uuid" } },
      required: ["id"],
      additionalProperties: false,
    },
    body: {
      type: "object",
      properties: { password: { type: "string", minLength: 12, maxLength: 128 } },
      required: ["password"],
      additionalProperties: false,
    },
  },
  docs: { tags: ["Operators"], description: "Replace an operator password and revoke all sessions." },
  middlewares: [checkAuth],
  entryPoint: async (req, res) =>
    res.jsonOk(
      200,
      "OPERATOR_PASSWORD_CHANGED",
      await changeOperatorPassword(req.validated.path.id, req.validated.body.password),
    ),
};
