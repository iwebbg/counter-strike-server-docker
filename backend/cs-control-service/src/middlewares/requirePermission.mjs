import { hasPermission } from "../auth/permissions.mjs";
import { writeAudit } from "../controllers/audit/services/AuditService.mjs";

export default function requirePermission(permission) {
  return async (req, res, next) => {
    const scopes = Array.isArray(req.user?.serverScopes) ? req.user.serverScopes : [];
    const route = String(req.route?.path || "");
    const serverReference = route.startsWith("/servers/:id") ? req.validated?.path?.id : req.validated?.query?.serverId;
    const scopedCollectionRead = req.method === "GET" && ["/servers", "/stats/overview"].includes(route);
    const scopeAllowed =
      !scopes.length || scopedCollectionRead || (serverReference && scopes.includes(serverReference));
    if (hasPermission(req.user, permission) && scopeAllowed) return next();
    await writeAudit(req, {
      action: "permission.denied",
      category: "security",
      status: "denied",
      targetType: "route",
      targetName: `${req.method} ${req.route?.path || req.path}`,
      metadata: { permission, serverScopes: scopes, serverReference: serverReference || null },
    });
    return res.jsonError(403, scopeAllowed ? "PERMISSION_DENIED" : "SERVER_SCOPE_DENIED", { permission });
  };
}
