import crypto from "node:crypto";
import Db from "../../../utils/Db.mjs";
import { notFound } from "../../../utils/HttpError.mjs";
import { controlledServerInspect } from "../../servers/services/ServersService.mjs";
import { evidenceStatus, safeEvidenceFilename } from "./EvidenceService.mjs";

function serverKey(inspect) {
  return (
    inspect.Config?.Env?.find((entry) => entry.startsWith("SERVER_ID="))?.slice(10) ||
    inspect.Config?.Labels?.["com.cs16.instance-id"] ||
    inspect.Id.slice(0, 12)
  );
}

function publicMarker(row) {
  return {
    id: row.id,
    serverId: row.server_id,
    filename: row.recording_filename,
    steamId: row.player_steam_id,
    playerName: row.player_name,
    reason: row.reason,
    offsetSeconds: row.marker_offset_seconds === null ? null : Number(row.marker_offset_seconds),
    operatorName: row.operator_name,
    createdAt: row.created_at,
  };
}

export async function listEvidenceMarkers(id) {
  const inspect = await controlledServerInspect(id);
  const rows = await (
    await new Db().db()
  )("panel_evidence_markers")
    .where({ server_id: serverKey(inspect) })
    .orderBy("created_at", "desc");
  return rows.map(publicMarker);
}

export async function createEvidenceMarker(id, input, actor) {
  const inspect = await controlledServerInspect(id);
  const status = await evidenceStatus(id);
  const requested = input.filename ? safeEvidenceFilename(input.filename) : null;
  const filename = requested || (status.recording ? `${status.filename}.dem` : null);
  const known = status.recordings.some((recording) => recording.filename === filename);
  const active = status.recording && `${status.filename}.dem` === filename;
  if (!filename || (!known && !active)) throw notFound("EVIDENCE_NOT_FOUND");
  const offsetSeconds =
    active && status.startedAt ? Math.max(0, Math.floor((Date.now() - Date.parse(status.startedAt)) / 1000)) : null;
  const row = {
    id: crypto.randomUUID(),
    server_id: serverKey(inspect),
    recording_filename: filename,
    player_steam_id: input.steamId,
    player_name: input.playerName.trim(),
    reason: input.reason.trim(),
    marker_offset_seconds: offsetSeconds,
    operator_user_id: actor?.id || null,
    operator_name: actor?.name || actor?.email || null,
    created_at: new Date(),
  };
  await (await new Db().db())("panel_evidence_markers").insert(row);
  return publicMarker(row);
}

export async function deleteEvidenceMarker(id, markerId) {
  const inspect = await controlledServerInspect(id);
  const db = await new Db().db();
  const marker = await db("panel_evidence_markers")
    .where({ id: markerId, server_id: serverKey(inspect) })
    .first();
  if (!marker) throw notFound("EVIDENCE_MARKER_NOT_FOUND");
  await db("panel_evidence_markers").where({ id: markerId }).delete();
  return publicMarker(marker);
}
