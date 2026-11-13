import { PERMISSIONS } from "../../../auth/permissions.mjs";
import checkAuth from "../../../middlewares/checkAuth.mjs";
import { listAuditLogs } from "../services/AuditService.mjs";

export default {
  route: "/audit-logs",
  method: "GET",
  bearerAuth: true,
  permission: PERMISSIONS.AUDIT_READ,
  validation: {
    query: {
      type: "object",
      properties: {
        operatorId: { type: "string", format: "uuid" },
        serverId: { type: "string", maxLength: 128 },
        action: { type: "string", maxLength: 96 },
        status: { type: "string", enum: ["success", "failure", "denied"] },
        from: { type: "string", format: "date-time" },
        to: { type: "string", format: "date-time" },
        limit: { type: "string", pattern: "^[0-9]{1,3}$" },
      },
      additionalProperties: false,
    },
    path: {},
    body: {},
  },
  docs: { tags: ["Audit"], description: "Filter panel audit events." },
  middlewares: [checkAuth],
  entryPoint: async (req, res) => res.jsonOk(200, "SUCCESS", await listAuditLogs(req.validated.query)),
};
