import { ALL_PERMISSIONS, PERMISSIONS, ROLES } from "../../../auth/permissions.mjs";
import checkAuth from "../../../middlewares/checkAuth.mjs";
import { createOperator } from "../services/OperatorService.mjs";

export default {
  route: "/operators",
  method: "POST",
  bearerAuth: true,
  permission: PERMISSIONS.OPERATORS_MANAGE,
  audit: (req) => ({ action: "operator.create", targetType: "operator", targetName: req.validated.body.email }),
  validation: {
    query: {},
    path: {},
    body: {
      type: "object",
      properties: {
        name: { type: "string", minLength: 2, maxLength: 128 },
        email: { type: "string", format: "email", maxLength: 254 },
        password: { type: "string", minLength: 12, maxLength: 128 },
        role: { type: "string", enum: ROLES },
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
      required: ["name", "email", "password", "role"],
      additionalProperties: false,
    },
  },
  docs: { tags: ["Operators"], description: "Create a control-panel operator." },
  middlewares: [checkAuth],
  entryPoint: async (req, res) => res.jsonOk(201, "OPERATOR_CREATED", await createOperator(req.validated.body)),
};
