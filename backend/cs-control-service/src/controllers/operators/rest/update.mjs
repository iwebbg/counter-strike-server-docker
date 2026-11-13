import { ALL_PERMISSIONS, PERMISSIONS, ROLES } from "../../../auth/permissions.mjs";
import checkAuth from "../../../middlewares/checkAuth.mjs";
import { updateOperator } from "../services/OperatorService.mjs";

export default {
  route: "/operators/:id",
  method: "PUT",
  bearerAuth: true,
  permission: PERMISSIONS.OPERATORS_MANAGE,
  audit: (req) => ({ action: "operator.update", targetType: "operator", targetId: req.validated.path.id }),
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
      minProperties: 1,
      properties: {
        name: { type: "string", minLength: 2, maxLength: 128 },
        role: { type: "string", enum: ROLES },
        active: { type: "boolean" },
        preferredLocale: { type: "string", enum: ["bg", "en"] },
        customPermissions: {
          type: "array",
          items: { type: "string", enum: ALL_PERMISSIONS },
          uniqueItems: true,
          maxItems: ALL_PERMISSIONS.length,
        },
        serverScopes: {
          type: "array",
          items: { type: "string", pattern: "^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}$" },
          uniqueItems: true,
          maxItems: 100,
        },
      },
      additionalProperties: false,
    },
  },
  docs: { tags: ["Operators"], description: "Update role, status or profile fields." },
  middlewares: [checkAuth],
  entryPoint: async (req, res) =>
    res.jsonOk(200, "OPERATOR_UPDATED", await updateOperator(req.validated.path.id, req.validated.body, req.user.id)),
};
