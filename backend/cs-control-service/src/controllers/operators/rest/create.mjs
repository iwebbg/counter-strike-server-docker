import { PERMISSIONS, ROLES } from "../../../auth/permissions.mjs";
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
      },
      required: ["name", "email", "password", "role"],
      additionalProperties: false,
    },
  },
  docs: { tags: ["Operators"], description: "Create a control-panel operator." },
  middlewares: [checkAuth],
  entryPoint: async (req, res) => res.jsonOk(201, "OPERATOR_CREATED", await createOperator(req.validated.body)),
};
