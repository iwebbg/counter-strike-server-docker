import checkAuth from "../../../middlewares/checkAuth.mjs";
import { previewDeployment } from "../services/DeploymentService.mjs";

export default {
  route: "/deployment/configuration/preview",
  method: "POST",
  bearerAuth: true,
  permission: "servers.manage",
  audit: () => ({ action: "deployment.preview", targetType: "deployment" }),
  validation: {
    query: {},
    path: {},
    body: {
      type: "object",
      properties: {
        changes: {
          type: "object",
          propertyNames: { pattern: "^[A-Z][A-Z0-9_]+$" },
          additionalProperties: { anyOf: [{ type: "string", maxLength: 255 }, { type: "number" }] },
          maxProperties: 16,
        },
      },
      required: ["changes"],
      additionalProperties: false,
    },
  },
  docs: { tags: ["Deployment"], description: "Preview .env changes without writing host files." },
  middlewares: [checkAuth],
  entryPoint: async (req, res) => res.jsonOk(200, "SUCCESS", previewDeployment(req.validated.body.changes)),
};
