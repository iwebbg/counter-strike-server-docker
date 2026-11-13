import crypto from "node:crypto";
import Db from "../../../utils/Db.mjs";
import { notFound } from "../../../utils/HttpError.mjs";
import { getServerConfiguration, updateServer } from "../../servers/services/ServersService.mjs";
import { normalizeConfiguration } from "../../configurationTemplates/services/ConfigurationTemplateService.mjs";

function parseConfiguration(value) {
  return typeof value === "string" ? JSON.parse(value) : value;
}

function publicRevision(row) {
  return {
    id: row.id,
    serverId: row.server_id,
    revision: row.revision,
    reason: row.reason,
    configuration: parseConfiguration(row.configuration),
    actorUserId: row.actor_user_id,
    actorName: row.actor_name,
    createdAt: row.created_at,
  };
}

async function insertRevision(db, serverId, configuration, actor, reason) {
  const latest = await db("panel_configuration_history")
    .where({ server_id: serverId })
    .max({ revision: "revision" })
    .first();
  const revision = Number(latest?.revision || 0) + 1;
  const row = {
    id: crypto.randomUUID(),
    server_id: serverId,
    revision,
    reason,
    configuration: JSON.stringify(normalizeConfiguration(configuration)),
    actor_user_id: actor?.id || null,
    actor_name: actor?.name || actor?.email || null,
  };
  await db("panel_configuration_history").insert(row);
  return publicRevision(row);
}

export async function listConfigurationHistory(serverId) {
  const db = await new Db().db();
  return (await db("panel_configuration_history").where({ server_id: serverId }).orderBy("revision", "desc")).map(
    publicRevision,
  );
}

export async function updateServerWithHistory(id, input, actor, reason = "update") {
  const before = await getServerConfiguration(id);
  const db = await new Db().db();
  const result = await updateServer(id, input);
  const stableId = result.serverId || id;
  const existing = await db("panel_configuration_history").where({ server_id: stableId }).first();
  if (!existing) await insertRevision(db, stableId, before, actor, "baseline");
  const after = await getServerConfiguration(stableId);
  await insertRevision(db, stableId, after, actor, reason);
  return result;
}

export async function rollbackConfiguration(serverId, revision, actor) {
  const db = await new Db().db();
  const row = await db("panel_configuration_history").where({ server_id: serverId, revision }).first();
  if (!row) throw notFound("CONFIGURATION_REVISION_NOT_FOUND");
  return updateServerWithHistory(serverId, parseConfiguration(row.configuration), actor, `rollback:${revision}`);
}
