import crypto from "node:crypto";
import { queryA2S } from "../../../infrastructure/A2S.mjs";
import { DockerClient, demuxDockerStream } from "../../../infrastructure/Docker.mjs";
import { parseStatusPlayers, rconCommand } from "../../../infrastructure/Rcon.mjs";
import Db from "../../../utils/Db.mjs";
import {
  globalAdmins,
  recordModeration,
  syncDatabaseAdmins,
  syncGlobalAdmins,
  syncServerRegistry,
} from "../../stats/services/StatsService.mjs";
import {
  parseAdminEntries,
  parseInteger,
  validateAdmins,
  validateCreateInput,
  validateModerationInput,
} from "./schemas.mjs";
const config = {
  image: process.env.SERVER_IMAGE || "cs16-server:local",
  network: process.env.PANEL_NETWORK || "cs16_default",
  portStart: parseInteger(process.env.PORT_RANGE_START || 27015, "PORT_RANGE_START", 1024, 65535),
  portEnd: parseInteger(process.env.PORT_RANGE_END || 27115, "PORT_RANGE_END", 1024, 65535),
  dbEnabled: process.env.DB_ENABLED === "1",
  dbHost: process.env.DB_HOST || "mariadb",
  dbName: process.env.DB_NAME || "cs16",
  dbUser: process.env.DB_USER || "cs16",
  dbPassword: process.env.DB_PASSWORD || "",
  killstreakEnabled: process.env.KILLSTREAK_ENABLED || "1",
  killstreakSounds: process.env.KILLSTREAK_SOUNDS_ENABLED || "1",
  killstreakHud: process.env.KILLSTREAK_HUD_ENABLED || "1",
  killstreakGlobal: process.env.KILLSTREAK_GLOBAL || "1",
  killstreakWindow: process.env.KILLSTREAK_MULTI_WINDOW || "4.0",
};

if (config.portStart > config.portEnd) {
  console.error("[panel] PORT_RANGE_START must not be greater than PORT_RANGE_END");
  process.exit(1);
}

const docker = new DockerClient();
const database = new Db();
const managedLabel = "com.cs16.controlled=true";
const managedAdminsFile = "/opt/hlds/cstrike/addons/amxmodx/data/panel_admins.txt";
const usersFile = "/opt/hlds/cstrike/addons/amxmodx/configs/users.ini";
const managedMapcycleFile = "/opt/hlds/cstrike/addons/amxmodx/data/panel_mapcycle.txt";
const mapcycleFile = "/opt/hlds/cstrike/mapcycle.txt";
const amxxMapsFile = "/opt/hlds/cstrike/addons/amxmodx/configs/maps.ini";
const moderationLog = "/opt/hlds/cstrike/addons/amxmodx/data/panel_moderation.log";

function envValue(inspect, name, fallback = "") {
  const prefix = `${name}=`;
  const entry = (inspect.Config.Env || []).find((value) => value.startsWith(prefix));
  return entry ? entry.slice(prefix.length) : fallback;
}

function serverKey(inspect) {
  return envValue(inspect, "SERVER_ID") || inspect.Config?.Labels?.["com.cs16.instance-id"] || inspect.Id.slice(0, 12);
}

function publishedPort(inspect) {
  const bindings = inspect.HostConfig?.PortBindings?.["27015/udp"];
  return bindings?.[0]?.HostPort ? Number(bindings[0].HostPort) : null;
}

function containerAddress(inspect) {
  const networks = inspect.NetworkSettings?.Networks || {};
  return (
    networks[config.network]?.IPAddress || Object.values(networks).find((network) => network.IPAddress)?.IPAddress || ""
  );
}

async function assertControlled(id) {
  if (!/^[a-f0-9]{12,64}$/.test(id)) throw new Error("Invalid server id");
  const inspect = await docker.request("GET", `/containers/${id}/json`);
  if (inspect.Config?.Labels?.["com.cs16.controlled"] !== "true")
    throw new Error("Container is not managed by CS Control");
  return inspect;
}

async function runExec(containerId, command) {
  const created = await docker.request("POST", `/containers/${containerId}/exec`, {
    AttachStdout: true,
    AttachStderr: true,
    Tty: false,
    User: "hlds",
    Cmd: command,
  });
  const output = await docker.request("POST", `/exec/${created.Id}/start`, { Detach: false, Tty: false });
  const result = await docker.request("GET", `/exec/${created.Id}/json`);
  const text = demuxDockerStream(output);
  if (result.ExitCode !== 0) throw new Error(text.trim() || `Container command failed (${result.ExitCode})`);
  return text;
}

function serializeAdmins(admins) {
  return admins.map(({ steamId, flags }) => `${steamId}|${flags}`).join(";");
}

function usersFileContent(admins) {
  const lines = [
    "; Managed live by CS Control.",
    "; SteamID authentication is used, so no admin passwords are stored.",
    '"loopback" "" "abcdefghijklmnopqrstu" "de"',
    ...admins.map(({ steamId, flags }) => `"${steamId}" "" "${flags}" "ce"`),
  ];
  return `${lines.join("\n")}\n`;
}

async function requireRunning(id) {
  const inspect = await assertControlled(id);
  if (!inspect.State?.Running) throw new Error("Start the server before using live management");
  return inspect;
}

async function installedMaps(id) {
  const output = await runExec(id, [
    "sh",
    "-c",
    'for file in /opt/hlds/cstrike/maps/*.bsp; do [ -f "$file" ] || continue; name=${file##*/}; printf "%s\\n" "${name%.bsp}"; done',
  ]);
  return output
    .split("\n")
    .map((map) => map.trim())
    .filter((map) => /^[a-zA-Z0-9_]+$/.test(map))
    .sort((left, right) => left.localeCompare(right));
}

async function categorizedMaps(id, inspect) {
  const mode = envValue(inspect, "SERVER_MODE", "classic");
  if (mode !== "classic" && mode !== "gungame") throw new Error(`Unsupported server mode: ${mode}`);
  const presetFile = `/opt/hlds/presets/maps/${mode}.txt`;
  const [installed, preset] = await Promise.all([
    installedMaps(id),
    runExec(id, ["sh", "-c", 'cat "$1"', "map-category", presetFile]),
  ]);
  const category = preset
    .split("\n")
    .map((map) => map.trim())
    .filter((map) => /^[a-zA-Z0-9_]+$/.test(map));
  return { mode, available: category.filter((map) => installed.includes(map)) };
}

async function readMaps(id, inspect) {
  const { mode, available } = await categorizedMaps(id, inspect);
  const output = await runExec(id, [
    "sh",
    "-c",
    `if [ -f '${managedMapcycleFile}' ]; then printf 'panel\\n'; cat '${managedMapcycleFile}'; else printf 'runtime\\n'; cat '${mapcycleFile}'; fi`,
  ]);
  const newline = output.indexOf("\n");
  const source = newline === -1 ? "runtime" : output.slice(0, newline).trim();
  const selected = output
    .slice(newline + 1)
    .split("\n")
    .map((map) => map.trim())
    .filter((map) => available.includes(map));
  const address = containerAddress(inspect);
  const game = address ? await queryA2S(address, 27015).catch(() => null) : null;
  return { source, mode, available, selected, current: game?.map || null };
}

async function saveMaps(id, inspect, maps) {
  const { mode, available } = await categorizedMaps(id, inspect);
  const missing = maps.filter((map) => !available.includes(map));
  if (missing.length)
    throw new Error(`Maps do not belong to the ${mode} category or are not installed: ${missing.join(", ")}`);
  const mapcycle = `${maps.join("\n")}\n`;
  const script = `printf '%s' "$1" > '${managedMapcycleFile}' && printf '%s' "$1" > '${mapcycleFile}' && printf '%s' "$1" > '${amxxMapsFile}'`;
  await runExec(id, ["sh", "-c", script, "map-sync", mapcycle]);
  return { source: "panel", mode, available, selected: maps, synchronized: true };
}

async function livePlayers(inspect) {
  const output = await rconCommand(containerAddress(inspect), 27015, envValue(inspect, "RCON_PASSWORD"), "status");
  return parseStatusPlayers(output);
}

async function writeModerationAudit(id, event) {
  const entry = JSON.stringify({ timestamp: new Date().toISOString(), ...event });
  await runExec(id, ["sh", "-c", `printf '%s\\n' "$1" >> '${moderationLog}'`, "moderation-audit", entry]);
}

async function moderatePlayer(id, inspect, userId, action, input) {
  const player = (await livePlayers(inspect)).find((entry) => entry.userId === userId);
  if (!player) throw new Error(`Player userid ${userId} is no longer connected`);
  const values = validateModerationInput(input, action);
  const address = containerAddress(inspect);
  const password = envValue(inspect, "RCON_PASSWORD");
  if (action === "ban" && !/^STEAM_[0-9]+:[01]:[0-9]+$/.test(player.steamId))
    throw new Error("Player does not have a bannable Steam ID");
  const centralBan = action === "ban" && database.enabled;

  if (centralBan) {
    await recordModeration(database, {
      serverId: serverKey(inspect),
      action,
      steamId: player.steamId,
      name: player.name,
      ...values,
    });
  }

  if (action === "kick") {
    await rconCommand(address, 27015, password, `amx_kick #${userId} "${values.reason}"`);
  } else {
    if (database.enabled) {
      await rconCommand(address, 27015, password, `amx_kick #${userId} "${values.reason}"`);
    } else {
      await rconCommand(address, 27015, password, `amx_ban ${values.minutes} #${userId} "${values.reason}"`);
      await rconCommand(address, 27015, password, "writeid");
    }
  }

  await writeModerationAudit(id, { action, userId, steamId: player.steamId, name: player.name, ...values });
  if (!centralBan) {
    await recordModeration(database, {
      serverId: serverKey(inspect),
      action,
      steamId: player.steamId,
      name: player.name,
      ...values,
    });
  }
  return {
    status: action === "kick" ? "kicked" : "banned",
    player: { name: player.name, steamId: player.steamId },
    ...values,
  };
}

async function readAdmins(id, inspect) {
  const output = await runExec(id, [
    "sh",
    "-c",
    `if [ -f '${managedAdminsFile}' ]; then printf 'panel\\n'; cat '${managedAdminsFile}'; else printf 'environment\\n'; printf '%s' "$AMXX_ADMINS"; fi`,
  ]);
  const newline = output.indexOf("\n");
  const source = newline === -1 ? "environment" : output.slice(0, newline).trim();
  const raw = newline === -1 ? envValue(inspect, "AMXX_ADMINS") : output.slice(newline + 1).trim();
  return { source, admins: parseAdminEntries(raw) };
}

async function reloadAdmins(id, inspect, admins, persist) {
  const serialized = serializeAdmins(admins);
  const users = usersFileContent(admins);
  const script = persist
    ? `printf '%s' "$1" > '${managedAdminsFile}' && printf '%s' "$2" > '${usersFile}'`
    : `rm -f '${managedAdminsFile}' && printf '%s' "$1" > '${usersFile}'`;
  const args = persist ? [script, "admin-sync", serialized, users] : [script, "admin-sync", users];
  await runExec(id, ["sh", "-c", ...args]);
  const address = containerAddress(inspect);
  const reloadOutput = await rconCommand(address, 27015, envValue(inspect, "RCON_PASSWORD"), "amx_reloadadmins");
  await syncDatabaseAdmins(database, serverKey(inspect), admins);
  return { source: persist ? "panel" : "environment", admins, reloaded: true, output: reloadOutput };
}

function mergeAdmins(...lists) {
  return [...new Map(lists.flat().map((admin) => [admin.steamId, admin])).values()];
}

async function applyFleetAdmins(admins) {
  await syncGlobalAdmins(database, admins);
  const filters = encodeURIComponent(JSON.stringify({ label: [managedLabel] }));
  const containers = await docker.request("GET", `/containers/json?filters=${filters}`);
  let updated = 0;
  for (const container of containers) {
    const inspect = await docker.request("GET", `/containers/${container.Id}/json`);
    if (!inspect.State?.Running) continue;
    await reloadAdmins(container.Id, inspect, admins, true);
    updated += 1;
  }
  return updated;
}

async function applyInheritedAdmins(id) {
  if (!database.enabled) return;
  const inspect = await requireRunning(id);
  const inherited = await globalAdmins(database);
  if (!inherited.length) return;
  const current = await readAdmins(id, inspect);
  await reloadAdmins(id, inspect, mergeAdmins(current.admins, inherited), true);
}

async function listServers() {
  const filters = encodeURIComponent(JSON.stringify({ label: [managedLabel] }));
  const containers = await docker.request("GET", `/containers/json?all=1&filters=${filters}`);

  const servers = await Promise.all(
    containers.map(async (container) => {
      const inspect = await docker.request("GET", `/containers/${container.Id}/json`);
      let game = null;
      if (inspect.State?.Running) {
        const address = containerAddress(inspect);
        if (address) game = await queryA2S(address, 27015).catch(() => null);
      }
      return {
        id: container.Id,
        serverId: serverKey(inspect),
        name: inspect.Config?.Labels?.["com.cs16.display-name"] || inspect.Name.replace(/^\//, ""),
        containerName: inspect.Name.replace(/^\//, ""),
        managedBy: inspect.Config?.Labels?.["com.cs16.managed-by"] || "unknown",
        mode: envValue(inspect, "SERVER_MODE", "classic"),
        maxPlayers: Number(envValue(inspect, "MAX_PLAYERS", 24)),
        startMap: envValue(inspect, "START_MAP", ""),
        port: publishedPort(inspect),
        state: inspect.State?.Status || "unknown",
        health: inspect.State?.Health?.Status || (inspect.State?.Running ? "running" : "stopped"),
        players: game?.players ?? null,
        liveMaxPlayers: game?.maxPlayers ?? null,
        map: game?.map || null,
        startedAt: inspect.State?.StartedAt || null,
      };
    }),
  );
  await syncServerRegistry(database, servers).catch((error) =>
    console.error("[panel] registry sync failed:", error.message),
  );
  return servers;
}

async function usedPorts() {
  const containers = await docker.request("GET", "/containers/json?all=1");
  const inspections = await Promise.all(
    containers.map((container) => docker.request("GET", `/containers/${container.Id}/json`)),
  );
  const ports = inspections.flatMap((inspect) =>
    Object.values(inspect.HostConfig?.PortBindings || {}).flatMap((bindings) =>
      (bindings || []).map((binding) => Number(binding.HostPort)).filter(Boolean),
    ),
  );
  return new Set(ports);
}

async function selectPort(requested) {
  const used = await usedPorts();
  if (requested !== null) {
    if (used.has(requested)) throw new Error(`Port ${requested} is already in use by Docker`);
    return requested;
  }
  for (let port = config.portStart; port <= config.portEnd; port += 1) {
    if (!used.has(port)) return port;
  }
  throw new Error("No free game ports remain in the configured range");
}

async function ensureVolume(name) {
  await docker.request("POST", "/volumes/create", { Name: name, Labels: { "com.cs16.controlled": "true" } });
}

async function createServer(input) {
  const values = validateCreateInput(input, config.portStart, config.portEnd);
  const port = await selectPort(values.port);
  const instanceId = crypto.randomUUID().slice(0, 8);
  const containerName = `cs16-instance-${instanceId}`;
  const volumePrefix = `cs16_${instanceId}`;
  const rconPassword = values.rconPassword || crypto.randomBytes(18).toString("base64url");
  const inheritedAdmins = await globalAdmins(database);
  const requestedAdmins = values.adminSteamIds.map((steamId) => ({ steamId, flags: "abcdefghijklmnopqrstu" }));
  const adminMap = new Map([...inheritedAdmins, ...requestedAdmins].map((admin) => [admin.steamId, admin]));
  const initialAdmins = [...adminMap.values()];

  await ensureVolume(`${volumePrefix}_logs`);
  await ensureVolume(`${volumePrefix}_data`);

  const container = await docker.request("POST", `/containers/create?name=${containerName}`, {
    Image: config.image,
    Env: [
      `SERVER_MODE=${values.mode}`,
      `SERVER_NAME=${values.name}`,
      `MAX_PLAYERS=${values.maxPlayers}`,
      `START_MAP=${values.startMap}`,
      `MAPCYCLE=${values.maps.join(",")}`,
      `RCON_PASSWORD=${rconPassword}`,
      `SERVER_PASSWORD=${values.serverPassword}`,
      "WARMUP_ENABLED=1",
      "WARMUP_SECONDS=45",
      `SPAWN_PROTECTION_ENABLED=${values.mode === "gungame" ? 1 : 0}`,
      "SPAWN_PROTECTION_SECONDS=3.0",
      "SEMICLIP_ENABLED=1",
      "AFK_MANAGER_ENABLED=1",
      "AFK_WARN_SECONDS=60",
      "AFK_SPECTATOR_SECONDS=90",
      "AFK_KICK_SECONDS=180",
      "RTV_ENABLED=1",
      "RTV_RATIO=0.60",
      "RTV_MIN_VOTES=2",
      "RTV_DELAY_SECONDS=120",
      "RECENT_MAPS=3",
      `KILLSTREAK_ENABLED=${config.killstreakEnabled}`,
      `KILLSTREAK_SOUNDS_ENABLED=${config.killstreakSounds}`,
      `KILLSTREAK_HUD_ENABLED=${config.killstreakHud}`,
      `KILLSTREAK_GLOBAL=${config.killstreakGlobal}`,
      `KILLSTREAK_MULTI_WINDOW=${config.killstreakWindow}`,
      `AMXX_ADMINS=${serializeAdmins(initialAdmins)}`,
      `DB_ENABLED=${config.dbEnabled ? 1 : 0}`,
      `DB_HOST=${config.dbHost}`,
      `DB_NAME=${config.dbName}`,
      `DB_USER=${config.dbUser}`,
      `DB_PASSWORD=${config.dbPassword}`,
      `SERVER_ID=${instanceId}`,
    ],
    Labels: {
      "com.cs16.controlled": "true",
      "com.cs16.managed-by": "panel",
      "com.cs16.instance-id": instanceId,
      "com.cs16.display-name": values.name,
    },
    ExposedPorts: { "27015/udp": {}, "27015/tcp": {} },
    Healthcheck: {
      Test: ["CMD-SHELL", "pgrep -x hlds_linux >/dev/null"],
      Interval: 30_000_000_000,
      Timeout: 5_000_000_000,
      Retries: 5,
      StartPeriod: 90_000_000_000,
    },
    HostConfig: {
      PortBindings: {
        "27015/udp": [{ HostIp: "0.0.0.0", HostPort: String(port) }],
        "27015/tcp": [{ HostIp: "0.0.0.0", HostPort: String(port) }],
      },
      RestartPolicy: { Name: "unless-stopped", MaximumRetryCount: 0 },
      StopTimeout: 30,
      Mounts: [
        { Type: "volume", Source: `${volumePrefix}_logs`, Target: "/opt/hlds/cstrike/logs" },
        { Type: "volume", Source: `${volumePrefix}_data`, Target: "/opt/hlds/cstrike/addons/amxmodx/data" },
      ],
    },
    NetworkingConfig: { EndpointsConfig: { [config.network]: {} } },
  });

  if (values.startImmediately) await docker.request("POST", `/containers/${container.Id}/start`);
  return { id: container.Id, instanceId, port, rconPassword, started: values.startImmediately };
}

export const portRange = () => [config.portStart, config.portEnd];
export { createServer, listServers };

export async function serverAction(id, action) {
  await assertControlled(id);
  const suffix = action === "stop" ? "/stop?t=30" : action === "restart" ? "/restart?t=30" : "/start";
  await docker.request("POST", `/containers/${id}${suffix}`);
  if (action === "start") await applyInheritedAdmins(id);
  return { status: action };
}

export async function serverLogs(id) {
  await assertControlled(id);
  const logs = await docker.request("GET", `/containers/${id}/logs?stdout=1&stderr=1&timestamps=1&tail=250`);
  return { logs: demuxDockerStream(logs) };
}

export async function getAdmins(id) {
  const inspect = await requireRunning(id);
  return readAdmins(id, inspect);
}

export async function updateAdmins(id, input) {
  const inspect = await requireRunning(id);
  const admins = validateAdmins(input);
  if (input.scope === "fleet") {
    const updatedServers = await applyFleetAdmins(admins);
    return { source: "database-fleet", admins, reloaded: true, updatedServers };
  }
  return reloadAdmins(id, inspect, admins, true);
}

export async function resetAdmins(id) {
  const inspect = await requireRunning(id);
  const admins = parseAdminEntries(envValue(inspect, "AMXX_ADMINS"));
  return reloadAdmins(id, inspect, admins, false);
}

export async function getMaps(id) {
  const inspect = await requireRunning(id);
  return readMaps(id, inspect);
}

export async function updateMaps(id, input) {
  const inspect = await requireRunning(id);
  return saveMaps(id, inspect, input.maps);
}

export async function changeMap(id, map) {
  const inspect = await requireRunning(id);
  const { available } = await categorizedMaps(id, inspect);
  if (!available.includes(map)) throw new Error("Map does not belong to this server mode or is not installed");
  await rconCommand(containerAddress(inspect), 27015, envValue(inspect, "RCON_PASSWORD"), `changelevel ${map}`);
  return { status: "changing", map };
}

export async function getPlayers(id) {
  const inspect = await requireRunning(id);
  return { players: await livePlayers(inspect) };
}

export async function moderate(id, userId, action, input) {
  const inspect = await requireRunning(id);
  return moderatePlayer(id, inspect, Number(userId), action, input);
}

export async function removeServer(id) {
  const inspect = await assertControlled(id);
  if (inspect.Config?.Labels?.["com.cs16.managed-by"] !== "panel")
    throw new Error("Compose-managed servers cannot be removed from the panel");
  if (inspect.State?.Running) throw new Error("Stop the server before removing it");
  await docker.request("DELETE", `/containers/${id}?v=0`);
  return { status: "removed", volumesPreserved: true };
}
