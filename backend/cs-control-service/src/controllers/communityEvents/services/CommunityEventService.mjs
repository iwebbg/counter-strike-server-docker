import crypto from "node:crypto";
import Db from "../../../utils/Db.mjs";
import { changeMap, listServers, serverAction } from "../../servers/services/ServersService.mjs";

const weekdayNumbers = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function httpError(status, code) {
  const error = new Error(code);
  error.status = status;
  error.code = code;
  return error;
}

export function scheduleParts(date, timezone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return {
    dayOfWeek: weekdayNumbers[parts.weekday],
    time: `${parts.hour}:${parts.minute}`,
    occurrenceKey: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

export function eventIsDue(event, date = new Date()) {
  const local = scheduleParts(date, event.timezone);
  return (
    Number(event.day_of_week) === local.dayOfWeek &&
    event.start_time === local.time &&
    event.last_occurrence_key !== local.occurrenceKey
  );
}

function publicEvent(row) {
  return {
    id: row.id,
    name: row.name,
    serverId: row.server_id,
    dayOfWeek: Number(row.day_of_week),
    startTime: row.start_time,
    timezone: row.timezone,
    durationMinutes: Number(row.duration_minutes),
    startMap: row.start_map,
    enabled: Boolean(row.enabled),
    lastRunAt: row.last_run_at,
    activeUntil: row.active_until,
    lastStatus: row.last_status,
    lastError: row.last_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function assertServer(serverId) {
  const server = (await listServers()).find((candidate) => candidate.serverId === serverId);
  if (!server) throw httpError(404, "CONTROLLED_SERVER_NOT_FOUND");
  return server;
}

function assertTimezone(timezone) {
  try {
    scheduleParts(new Date(), timezone);
  } catch {
    throw httpError(400, "INVALID_TIMEZONE");
  }
}

export async function listCommunityEvents() {
  const db = await new Db().db();
  return (await db("panel_community_events").orderBy(["day_of_week", "start_time", "name"])).map(publicEvent);
}

export async function createCommunityEvent(input, actorId) {
  await assertServer(input.serverId);
  assertTimezone(input.timezone);
  const db = await new Db().db();
  const id = crypto.randomUUID();
  await db("panel_community_events").insert({
    id,
    name: input.name.trim(),
    server_id: input.serverId,
    day_of_week: input.dayOfWeek,
    start_time: input.startTime,
    timezone: input.timezone,
    duration_minutes: input.durationMinutes,
    start_map: input.startMap || null,
    enabled: input.enabled,
    created_by: actorId,
    created_at: new Date(),
    updated_at: new Date(),
  });
  return publicEvent(await db("panel_community_events").where({ id }).first());
}

export async function updateCommunityEvent(id, input) {
  const db = await new Db().db();
  const existing = await db("panel_community_events").where({ id }).first();
  if (!existing) throw httpError(404, "COMMUNITY_EVENT_NOT_FOUND");
  if (input.serverId !== undefined) await assertServer(input.serverId);
  if (input.timezone !== undefined) assertTimezone(input.timezone);
  const changes = { updated_at: new Date() };
  const mapping = {
    name: "name",
    serverId: "server_id",
    dayOfWeek: "day_of_week",
    startTime: "start_time",
    timezone: "timezone",
    durationMinutes: "duration_minutes",
    enabled: "enabled",
  };
  for (const [source, target] of Object.entries(mapping)) {
    if (input[source] !== undefined) changes[target] = source === "name" ? input[source].trim() : input[source];
  }
  if (input.startMap !== undefined) changes.start_map = input.startMap || null;
  await db("panel_community_events").where({ id }).update(changes);
  return publicEvent(await db("panel_community_events").where({ id }).first());
}

export async function deleteCommunityEvent(id) {
  const db = await new Db().db();
  const removed = await db("panel_community_events").where({ id }).delete();
  if (!removed) throw httpError(404, "COMMUNITY_EVENT_NOT_FOUND");
  return { id, status: "deleted" };
}

async function waitAndChangeMap(serverId, map) {
  if (!map) return;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      await changeMap(serverId, map);
      return;
    } catch (error) {
      if (attempt === 19) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
  }
}

export async function runCommunityEvent(id, occurrenceKey = `manual-${Date.now()}`) {
  const db = await new Db().db();
  const event = await db("panel_community_events").where({ id }).first();
  if (!event) throw httpError(404, "COMMUNITY_EVENT_NOT_FOUND");
  const server = await assertServer(event.server_id);
  try {
    if (server.state !== "running") await serverAction(event.server_id, "start");
    await waitAndChangeMap(event.server_id, event.start_map);
    const now = new Date();
    const activeUntil = new Date(now.getTime() + Number(event.duration_minutes) * 60_000);
    await db("panel_community_events").where({ id }).update({
      last_occurrence_key: occurrenceKey,
      last_run_at: now,
      active_until: activeUntil,
      last_status: "running",
      last_error: null,
      updated_at: now,
    });
    return { ...publicEvent(event), status: "running", activeUntil };
  } catch (error) {
    await db("panel_community_events")
      .where({ id })
      .update({
        last_occurrence_key: occurrenceKey,
        last_run_at: new Date(),
        active_until: null,
        last_status: "failed",
        last_error: String(error.message || error).slice(0, 2000),
        updated_at: new Date(),
      });
    throw error;
  }
}

export async function runDueCommunityEvents(now = new Date()) {
  const db = await new Db().db();
  const rows = await db("panel_community_events").where({ enabled: true });
  let started = 0;
  let stopped = 0;
  for (const event of rows) {
    if (event.active_until && new Date(event.active_until) <= now) {
      try {
        const server = await assertServer(event.server_id);
        if (server.state === "running") await serverAction(event.server_id, "stop");
        await db("panel_community_events").where({ id: event.id }).update({
          active_until: null,
          last_status: "completed",
          last_error: null,
          updated_at: now,
        });
        stopped += 1;
      } catch (error) {
        await db("panel_community_events")
          .where({ id: event.id })
          .update({
            last_status: "failed",
            last_error: String(error.message || error).slice(0, 2000),
            updated_at: now,
          });
      }
    }
    if (eventIsDue(event, now)) {
      const occurrenceKey = scheduleParts(now, event.timezone).occurrenceKey;
      await runCommunityEvent(event.id, occurrenceKey).catch((error) =>
        console.error("[community-events] start failed", { eventId: event.id, error: error.message }),
      );
      started += 1;
    }
  }
  return { attempted: rows.length, started, stopped };
}
