import { hasPermission } from "../auth/permissions.mjs";
import { writeAudit } from "../controllers/audit/services/AuditService.mjs";

export default function requirePermission(permission) {
  return async (req, res, next) => {
    if (hasPermission(req.user, permission)) return next();
    await writeAudit(req, {
      action: "permission.denied",
      category: "security",
      status: "denied",
      targetType: "route",
      targetName: `${req.method} ${req.route?.path || req.path}`,
      metadata: { permission },
    });
    return res.jsonError(403, "PERMISSION_DENIED", { permission });
  };
}
