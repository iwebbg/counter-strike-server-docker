import crypto from "node:crypto";
import Db from "../../../utils/Db.mjs";

const text = (value, max = 255) => (value == null || value === "" ? null : String(value).slice(0, max));

function clientIp(req) {
  return text(req.ip || req.socket?.remoteAddress, 64);
}

export async function writeAudit(req, event) {
  if (!Db.enabled) return;
  try {
    const db = await new Db().db();
    await db("panel_audit_logs").insert({
      id: crypto.randomUUID(),
      actor_user_id: req.user?.id || null,
      actor_name: text(req.user?.name, 128),
      actor_email: text(req.user?.email, 254),
      action: text(event.action, 96),
      category: text(event.category || String(event.action).split(".")[0], 48),
      target_type: text(event.targetType, 48),
      target_id: text(event.targetId, 128),
      target_name: text(event.targetName, 255),
      server_id: text(event.serverId, 128),
      status: event.status === "failure" || event.status === "denied" ? event.status : "success",
      request_id: text(req.requestId, 64),
      ip_address: clientIp(req),
      user_agent: text(req.get?.("user-agent"), 512),
      metadata: JSON.stringify(event.metadata || {}),
      created_at: new Date(),
    });
  } catch (error) {
    console.error("Failed to write panel audit event", { action: event.action, message: error.message });
  }
}

export async function listAuditLogs(filters = {}) {
  const db = await new Db().db();
  const limit = Math.min(Math.max(Number(filters.limit) || 50, 1), 200);
  const query = db("panel_audit_logs as audit")
    .select(
      "audit.id",
      "audit.actor_user_id as actorUserId",
      "audit.actor_name as actorName",
      "audit.actor_email as actorEmail",
      "audit.action",
      "audit.category",
      "audit.target_type as targetType",
      "audit.target_id as targetId",
      "audit.target_name as targetName",
      "audit.server_id as serverId",
      "audit.status",
      "audit.request_id as requestId",
      "audit.ip_address as ipAddress",
      "audit.metadata",
      "audit.created_at as createdAt",
    )
    .orderBy("audit.created_at", "desc")
    .limit(limit);
  if (filters.operatorId) query.where("audit.actor_user_id", filters.operatorId);
  if (filters.serverId) query.where("audit.server_id", filters.serverId);
  if (filters.action) query.where("audit.action", filters.action);
  if (filters.status) query.where("audit.status", filters.status);
  if (filters.from) query.where("audit.created_at", ">=", new Date(filters.from));
  if (filters.to) query.where("audit.created_at", "<=", new Date(filters.to));
  const events = await query;
  for (const event of events) {
    if (typeof event.metadata === "string") {
      try {
        event.metadata = JSON.parse(event.metadata);
      } catch {
        event.metadata = {};
      }
    }
  }
  const actions = await db("panel_audit_logs").distinct("action").orderBy("action");
  const operators = await db("panel_audit_logs")
    .whereNotNull("actor_user_id")
    .distinct("actor_user_id as id", "actor_name as name", "actor_email as email")
    .orderBy("actor_name");
  return { events, actions: actions.map((row) => row.action), operators };
}
