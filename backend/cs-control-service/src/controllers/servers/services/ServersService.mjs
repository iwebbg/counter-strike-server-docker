import crypto from "node:crypto";
import { queryA2S } from "../../../infrastructure/A2S.mjs";
import { DockerClient, DockerError, demuxDockerStream } from "../../../infrastructure/Docker.mjs";
import { parseStatusPlayers, rconCommand } from "../../../infrastructure/Rcon.mjs";
import Db from "../../../utils/Db.mjs";
import { badRequest, conflict, notFound } from "../../../utils/HttpError.mjs";
import {
  globalAdmins,
  recordModeration,
  syncDatabaseAdmins,
  syncGlobalAdmins,
  syncServerRegistry,
} from "../../stats/services/StatsService.mjs";
import {
  modeMaps,
  parseAdminEntries,
  parseInteger,
  validateAdmins,
  validateCreateInput,
  validateEditInput,
  validateModerationInput,
} from "./schemas.mjs";
import { deleteServerDefinition, saveServerDefinition } from "./ServerDefinitionService.mjs";
const config = {
  image: process.env.SERVER_IMAGE || "cs16-server:local",
  network: process.env.PANEL_NETWORK || "cs16_default",
  allowedNetworks: (process.env.PANEL_ALLOWED_NETWORKS || process.env.PANEL_NETWORK || "cs16_default")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
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
  safeNameEnabled: process.env.SAFE_NAME_ENABLED || "1",
  safeChatEnabled: process.env.SAFE_CHAT_ENABLED || "1",
  chatSpamLimit: process.env.CHAT_SPAM_LIMIT || "5",
  chatSpamWindow: process.env.CHAT_SPAM_WINDOW || "6.0",
  chatBlockSeconds: process.env.CHAT_BLOCK_SECONDS || "15",
  forbiddenNames: process.env.FORBIDDEN_NAMES || "console,server,admin",
  forbiddenChat: process.env.FORBIDDEN_CHAT || "",
  amxxBrandingMessage: process.env.AMXX_BRANDING_MESSAGE || "%hostname% is powered by CS 1.6 Server CP | interweb.bg",
  amxxBrandingInterval: process.env.AMXX_BRANDING_INTERVAL || "600",
  amxxBrandingColor: process.env.AMXX_BRANDING_COLOR || "201255074",
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
const dataMountTarget = "/opt/hlds/cstrike/addons/amxmodx/data";
const customMapsRoot = `${dataMountTarget}/custom_maps`;

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

async function waitForGameReady(containerId, timeoutMs = Number(process.env.SERVER_READY_TIMEOUT_MS || 90000)) {
  const deadline = Date.now() + timeoutMs;
  let lastError = "Game server did not answer A2S";
  while (Date.now() < deadline) {
    const inspect = await docker.request("GET", `/containers/${containerId}/json`);
    if (!inspect.State?.Running)
      throw new Error(`Replacement container stopped: ${inspect.State?.Status || "unknown"}`);
    if (inspect.State?.Health?.Status === "unhealthy") throw new Error("Replacement container became unhealthy");
    const address = containerAddress(inspect);
    if (address) {
      try {
        const game = await queryA2S(address, 27015);
        return {
          state: inspect.State?.Status || "running",
          health: inspect.State?.Health?.Status || "running",
          map: game.map,
        };
      } catch (error) {
        lastError = error.message;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Replacement server readiness timeout: ${lastError}`);
}

export async function resolveControlledServer(dockerClient, id) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}$/.test(id)) throw badRequest("INVALID_SERVER_ID");
  let inspect = null;
  if (/^[a-f0-9]{12,64}$/.test(id)) {
    try {
      inspect = await dockerClient.request("GET", `/containers/${id}/json`);
    } catch (error) {
      if (!(error instanceof DockerError) || error.statusCode !== 404) throw error;
    }
  }
  if (!inspect) {
    const filters = encodeURIComponent(JSON.stringify({ label: [managedLabel] }));
    const containers = await dockerClient.request("GET", `/containers/json?all=1&filters=${filters}`);
    const inspections = await Promise.all(
      containers.map((container) => dockerClient.request("GET", `/containers/${container.Id}/json`)),
    );
    const matches = inspections.filter((candidate) => serverKey(candidate) === id);
    if (matches.length > 1) throw conflict("DUPLICATE_SERVER_ID");
    inspect = matches[0] || null;
  }
  if (!inspect) throw notFound("SERVER_NOT_FOUND");
  if (inspect.Config?.Labels?.["com.cs16.controlled"] !== "true")
    throw new Error("Container is not managed by CS Control");
  return inspect;
}

async function assertControlled(id) {
  return resolveControlledServer(docker, id);
}

function assertPanelManaged(inspect) {
  if (inspect.Config?.Labels?.["com.cs16.managed-by"] !== "panel") {
    throw conflict("COMPOSE_MANAGED_SERVER");
  }
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
  const customCategory = `${customMapsRoot}/categories/${mode}.txt`;
  const [installed, preset] = await Promise.all([
    installedMaps(id),
    runExec(id, [
      "sh",
      "-c",
      'cat "$1"; if [ -f "$2" ]; then cat "$2"; fi',
      "map-category",
      presetFile,
      customCategory,
    ]),
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
  const current = await readAdmins(inspect.Id, inspect);
  await reloadAdmins(inspect.Id, inspect, mergeAdmins(current.admins, inherited), true);
}

async function listServers() {
  const filters = encodeURIComponent(JSON.stringify({ label: [managedLabel] }));
  const containers = await docker.request("GET", `/containers/json?all=1&filters=${filters}`);
  const targetImage = await docker.request("GET", `/images/${encodeURIComponent(config.image)}/json`).catch(() => null);

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
        image: inspect.Config?.Image || "",
        imageId: inspect.Image || "",
        targetImageId: targetImage?.Id || null,
        updateAvailable:
          inspect.Config?.Labels?.["com.cs16.managed-by"] === "panel" &&
          Boolean(targetImage?.Id) &&
          inspect.Image !== targetImage.Id,
      };
    }),
  );
  await syncServerRegistry(database, servers).catch((error) =>
    console.error("[panel] registry sync failed:", error.message),
  );
  return servers;
}

async function usedPorts(excludedContainerId = null) {
  const containers = await docker.request("GET", "/containers/json?all=1");
  const inspections = await Promise.all(
    containers
      .filter((container) => container.Id !== excludedContainerId)
      .map((container) => docker.request("GET", `/containers/${container.Id}/json`)),
  );
  const ports = inspections.flatMap((inspect) =>
    Object.values(inspect.HostConfig?.PortBindings || {}).flatMap((bindings) =>
      (bindings || []).map((binding) => Number(binding.HostPort)).filter(Boolean),
    ),
  );
  return new Set(ports);
}

async function selectPort(requested, excludedContainerId = null) {
  const used = await usedPorts(excludedContainerId);
  if (requested !== null) {
    if (used.has(requested)) throw new Error(`Port ${requested} is already in use by Docker`);
    return requested;
  }
  for (let port = config.portStart; port <= config.portEnd; port += 1) {
    if (!used.has(port)) return port;
  }
  throw new Error("No free game ports remain in the configured range");
}

function environmentMap(inspect) {
  return new Map(
    (inspect.Config?.Env || []).map((entry) => {
      const separator = entry.indexOf("=");
      return separator === -1 ? [entry, ""] : [entry.slice(0, separator), entry.slice(separator + 1)];
    }),
  );
}

function normalizedMounts(inspect) {
  return (inspect.Mounts || []).map((mount) => ({
    Type: mount.Type,
    Source: mount.Name || mount.Source,
    Target: mount.Destination,
    ReadOnly: mount.RW === false,
  }));
}

function networkConfig(inspect, selectedNetwork = null) {
  if (selectedNetwork) return { EndpointsConfig: { [selectedNetwork]: {} } };
  const names = Object.keys(inspect.NetworkSettings?.Networks || {});
  const networks = names.length ? names : [config.network];
  return { EndpointsConfig: Object.fromEntries(networks.map((name) => [name, {}])) };
}

function containerPayload(
  inspect,
  { env, labels, port, image = inspect.Config.Image, cpuLimit = null, memoryLimitMb = null, network = null },
) {
  const currentBindings = inspect.HostConfig?.PortBindings || {};
  const hostIp = currentBindings["27015/udp"]?.[0]?.HostIp || "0.0.0.0";
  return {
    Image: image,
    Env: [...env].map(([key, value]) => `${key}=${value}`),
    Labels: labels,
    ExposedPorts: inspect.Config.ExposedPorts || { "27015/udp": {}, "27015/tcp": {} },
    Healthcheck: inspect.Config.Healthcheck,
    HostConfig: {
      PortBindings: {
        "27015/udp": [{ HostIp: hostIp, HostPort: String(port) }],
        "27015/tcp": [{ HostIp: hostIp, HostPort: String(port) }],
      },
      RestartPolicy: inspect.HostConfig?.RestartPolicy || { Name: "unless-stopped", MaximumRetryCount: 0 },
      StopTimeout: inspect.Config?.StopTimeout ?? inspect.HostConfig?.StopTimeout ?? 30,
      Mounts: normalizedMounts(inspect),
      NanoCpus: cpuLimit == null ? inspect.HostConfig?.NanoCpus || 0 : Math.round(cpuLimit * 1_000_000_000),
      Memory: memoryLimitMb == null ? inspect.HostConfig?.Memory || 0 : memoryLimitMb * 1024 * 1024,
    },
    NetworkingConfig: networkConfig(inspect, network),
  };
}

function dataVolume(inspect) {
  const mount = (inspect.Mounts || []).find(
    (entry) => entry.Type === "volume" && entry.Destination === dataMountTarget,
  );
  if (!mount?.Name) throw new Error("The server AMXX data volume could not be found");
  return mount.Name;
}

async function volumeCommand(volume, script, args = []) {
  const helperName = `cs16-volume-helper-${crypto.randomUUID().slice(0, 8)}`;
  let helper = null;
  try {
    helper = await docker.request("POST", `/containers/create?name=${helperName}`, {
      Image: config.image,
      User: "hlds",
      Entrypoint: ["sh", "-c"],
      Cmd: [script, "volume-helper", ...args],
      Labels: { "com.cs16.temporary": "true" },
      HostConfig: {
        Mounts: [{ Type: "volume", Source: volume, Target: "/data" }],
      },
    });
    await docker.request("POST", `/containers/${helper.Id}/start`);
    const result = await docker.request("POST", `/containers/${helper.Id}/wait?condition=not-running`);
    const logs = await docker.request("GET", `/containers/${helper.Id}/logs?stdout=1&stderr=1`);
    const output = demuxDockerStream(logs);
    if (result.StatusCode !== 0) throw new Error(output.trim() || `Volume helper failed (${result.StatusCode})`);
    return output;
  } finally {
    if (helper?.Id) await docker.request("DELETE", `/containers/${helper.Id}?force=1&v=0`).catch(() => {});
  }
}

async function readPersistentMapcycle(inspect) {
  return volumeCommand(
    dataVolume(inspect),
    "if [ -f /data/panel_mapcycle.txt ]; then cat /data/panel_mapcycle.txt; fi",
  );
}

async function writePersistentMapcycle(inspect, maps) {
  await volumeCommand(dataVolume(inspect), "printf '%s' \"$1\" > /data/panel_mapcycle.txt", [`${maps.join("\n")}\n`]);
}

async function restorePersistentMapcycle(inspect, content) {
  const script = content ? "printf '%s' \"$1\" > /data/panel_mapcycle.txt" : "rm -f /data/panel_mapcycle.txt";
  await volumeCommand(dataVolume(inspect), script, content ? [content] : []);
}

async function ensureVolume(name) {
  await docker.request("POST", "/volumes/create", { Name: name, Labels: { "com.cs16.controlled": "true" } });
}

async function createServer(input, options = {}) {
  const values = validateCreateInput(input, config.portStart, config.portEnd);
  const port = await selectPort(values.port);
  const requestedInstanceId = String(options.instanceId || "").trim();
  if (requestedInstanceId && !/^[a-z0-9][a-z0-9-]{0,63}$/.test(requestedInstanceId)) {
    throw new Error("Invalid preserved server ID");
  }
  const instanceId = requestedInstanceId || crypto.randomUUID().slice(0, 8);
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
      `SAFE_NAME_ENABLED=${config.safeNameEnabled}`,
      `SAFE_CHAT_ENABLED=${config.safeChatEnabled}`,
      `CHAT_SPAM_LIMIT=${config.chatSpamLimit}`,
      `CHAT_SPAM_WINDOW=${config.chatSpamWindow}`,
      `CHAT_BLOCK_SECONDS=${config.chatBlockSeconds}`,
      `FORBIDDEN_NAMES=${config.forbiddenNames}`,
      `FORBIDDEN_CHAT=${config.forbiddenChat}`,
      `AMXX_BRANDING_MESSAGE=${config.amxxBrandingMessage}`,
      `AMXX_BRANDING_INTERVAL=${config.amxxBrandingInterval}`,
      `AMXX_BRANDING_COLOR=${config.amxxBrandingColor}`,
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

  const createdInspect = await docker.request("GET", `/containers/${container.Id}/json`);
  await saveServerDefinition(createdInspect, values.startImmediately ? "running" : "stopped", database);
  if (values.startImmediately) await docker.request("POST", `/containers/${container.Id}/start`);
  return { id: container.Id, instanceId, port, rconPassword, started: values.startImmediately };
}

export async function getServerConfiguration(id) {
  const inspect = await assertControlled(id);
  assertPanelManaged(inspect);
  const mode = envValue(inspect, "SERVER_MODE", "classic");
  const persistent = await readPersistentMapcycle(inspect);
  const storedMaps = persistent
    .split("\n")
    .map((map) => map.trim())
    .filter(Boolean);
  const environmentMaps = envValue(inspect, "MAPCYCLE")
    .split(",")
    .map((map) => map.trim())
    .filter(Boolean);
  const allowedMaps = mode === "gungame" || mode === "classic" ? modeMaps[mode] : [];
  const maps = (storedMaps.length ? storedMaps : environmentMaps).filter((map) => allowedMaps.includes(map));
  const selectedMaps = maps.length ? maps : allowedMaps;
  const configuredStartMap = envValue(inspect, "START_MAP", selectedMaps[0]);

  return {
    id: inspect.Id,
    name: inspect.Config?.Labels?.["com.cs16.display-name"] || envValue(inspect, "SERVER_NAME"),
    mode,
    maxPlayers: Number(envValue(inspect, "MAX_PLAYERS", 24)),
    startMap: selectedMaps.includes(configuredStartMap) ? configuredStartMap : selectedMaps[0],
    maps: selectedMaps,
    port: publishedPort(inspect),
    hasRconPassword: Boolean(envValue(inspect, "RCON_PASSWORD")),
    hasServerPassword: Boolean(envValue(inspect, "SERVER_PASSWORD")),
    running: Boolean(inspect.State?.Running),
    volumes: normalizedMounts(inspect)
      .filter((mount) => mount.Type === "volume")
      .map((mount) => mount.Source),
    welcomeMessage: envValue(inspect, "WELCOME_MESSAGE", "Welcome to our CS 1.6 server!"),
    warmupEnabled: envValue(inspect, "WARMUP_ENABLED", "1") === "1",
    warmupSeconds: Number(envValue(inspect, "WARMUP_SECONDS", 45)),
    spawnProtectionEnabled: envValue(inspect, "SPAWN_PROTECTION_ENABLED", mode === "gungame" ? "1" : "0") === "1",
    spawnProtectionSeconds: Number(envValue(inspect, "SPAWN_PROTECTION_SECONDS", 3)),
    semiclipEnabled: envValue(inspect, "SEMICLIP_ENABLED", "1") === "1",
    doubleJumpEnabled: envValue(inspect, "GG_DOUBLEJUMP_ENABLED", "1") === "1",
    doubleJumpVelocity: Number(envValue(inspect, "GG_DOUBLEJUMP_VELOCITY", 350)),
    afkEnabled: envValue(inspect, "AFK_MANAGER_ENABLED", "1") === "1",
    rtvEnabled: envValue(inspect, "RTV_ENABLED", "1") === "1",
    killstreakEnabled: envValue(inspect, "KILLSTREAK_ENABLED", "1") === "1",
    killstreakSoundsEnabled: envValue(inspect, "KILLSTREAK_SOUNDS_ENABLED", "1") === "1",
    killstreakHudEnabled: envValue(inspect, "KILLSTREAK_HUD_ENABLED", "1") === "1",
    cpuLimit: inspect.HostConfig?.NanoCpus ? inspect.HostConfig.NanoCpus / 1_000_000_000 : null,
    memoryLimitMb: inspect.HostConfig?.Memory ? Math.round(inspect.HostConfig.Memory / 1024 / 1024) : null,
    network: Object.keys(inspect.NetworkSettings?.Networks || {})[0] || config.network,
    allowedNetworks: config.allowedNetworks,
  };
}

export async function updateServer(id, input) {
  const inspect = await assertControlled(id);
  assertPanelManaged(inspect);
  const values = validateEditInput(input, config.portStart, config.portEnd);
  if (values.cpuLimit != null && (!Number.isFinite(values.cpuLimit) || values.cpuLimit < 0.25 || values.cpuLimit > 8)) {
    throw new Error("CPU limit must be between 0.25 and 8 cores");
  }
  const selectedNetwork = values.network || Object.keys(inspect.NetworkSettings?.Networks || {})[0] || config.network;
  if (!config.allowedNetworks.includes(selectedNetwork)) throw new Error("Docker network is not allowlisted");
  const oldPort = publishedPort(inspect);
  const port = await selectPort(values.port ?? oldPort, inspect.Id);
  const wasRunning = Boolean(inspect.State?.Running);
  const originalName = inspect.Name.replace(/^\//, "");
  const temporaryName = `${originalName}-edit-${crypto.randomUUID().slice(0, 8)}`;
  const originalEnv = environmentMap(inspect);
  const originalLabels = { ...(inspect.Config?.Labels || {}) };
  const originalPayload = containerPayload(inspect, {
    env: originalEnv,
    labels: originalLabels,
    port: oldPort,
  });
  const previousMapcycle = await readPersistentMapcycle(inspect);
  const nextEnv = new Map(originalEnv);
  nextEnv.set("SERVER_NAME", values.name);
  nextEnv.set("SERVER_MODE", values.mode);
  nextEnv.set("MAX_PLAYERS", String(values.maxPlayers));
  nextEnv.set("START_MAP", values.startMap);
  nextEnv.set("MAPCYCLE", values.maps.join(","));
  nextEnv.set("WELCOME_MESSAGE", values.welcomeMessage);
  nextEnv.set("WARMUP_ENABLED", values.warmupEnabled ? "1" : "0");
  nextEnv.set("WARMUP_SECONDS", String(values.warmupSeconds));
  nextEnv.set("SPAWN_PROTECTION_ENABLED", values.spawnProtectionEnabled ? "1" : "0");
  nextEnv.set("SPAWN_PROTECTION_SECONDS", String(values.spawnProtectionSeconds));
  nextEnv.set("SEMICLIP_ENABLED", values.semiclipEnabled ? "1" : "0");
  nextEnv.set("GG_DOUBLEJUMP_ENABLED", values.doubleJumpEnabled ? "1" : "0");
  nextEnv.set("GG_DOUBLEJUMP_VELOCITY", String(values.doubleJumpVelocity));
  nextEnv.set("AFK_MANAGER_ENABLED", values.afkEnabled ? "1" : "0");
  nextEnv.set("RTV_ENABLED", values.rtvEnabled ? "1" : "0");
  nextEnv.set("KILLSTREAK_ENABLED", values.killstreakEnabled ? "1" : "0");
  nextEnv.set("KILLSTREAK_SOUNDS_ENABLED", values.killstreakSoundsEnabled ? "1" : "0");
  nextEnv.set("KILLSTREAK_HUD_ENABLED", values.killstreakHudEnabled ? "1" : "0");
  if (values.rconPassword) nextEnv.set("RCON_PASSWORD", values.rconPassword);
  if (values.clearServerPassword) nextEnv.set("SERVER_PASSWORD", "");
  else if (values.serverPassword) nextEnv.set("SERVER_PASSWORD", values.serverPassword);
  const nextLabels = { ...originalLabels, "com.cs16.display-name": values.name };
  const nextPayload = containerPayload(inspect, {
    env: nextEnv,
    labels: nextLabels,
    port,
    cpuLimit: values.cpuLimit,
    memoryLimitMb: values.memoryLimitMb,
    network: selectedNetwork,
  });
  let replacement = null;
  let oldRemoved = false;

  try {
    replacement = await docker.request(
      "POST",
      `/containers/create?name=${encodeURIComponent(temporaryName)}`,
      nextPayload,
    );
    await writePersistentMapcycle(inspect, values.maps);
    if (wasRunning) await docker.request("POST", `/containers/${inspect.Id}/stop?t=30`);
    await docker.request("DELETE", `/containers/${inspect.Id}?v=0`);
    oldRemoved = true;
    await docker.request("POST", `/containers/${replacement.Id}/rename?name=${encodeURIComponent(originalName)}`);
    let readiness = { state: "stopped", health: "stopped", map: null };
    if (wasRunning) {
      await docker.request("POST", `/containers/${replacement.Id}/start`);
      readiness = await waitForGameReady(replacement.Id);
    }
    await saveServerDefinition(
      await docker.request("GET", `/containers/${replacement.Id}/json`),
      wasRunning ? "running" : "stopped",
      database,
    );
    return {
      id: replacement.Id,
      serverId: serverKey({
        ...inspect,
        Config: { ...inspect.Config, Env: [...nextEnv].map(([key, value]) => `${key}=${value}`) },
      }),
      port,
      restarted: wasRunning,
      volumesPreserved: true,
      readiness,
      rollback: { attempted: false, restored: false },
    };
  } catch (error) {
    if (replacement?.Id) {
      await docker.request("DELETE", `/containers/${replacement.Id}?force=1&v=0`).catch(() => {});
    }
    if (!oldRemoved) {
      await restorePersistentMapcycle(inspect, previousMapcycle).catch(() => {});
      if (wasRunning) await docker.request("POST", `/containers/${inspect.Id}/start`).catch(() => {});
      throw error;
    }

    let rollbackMessage = "";
    try {
      await restorePersistentMapcycle(inspect, previousMapcycle);
      const restored = await docker.request(
        "POST",
        `/containers/create?name=${encodeURIComponent(originalName)}`,
        originalPayload,
      );
      if (wasRunning) {
        await docker.request("POST", `/containers/${restored.Id}/start`);
        await waitForGameReady(restored.Id);
      }
      rollbackMessage = " The original server configuration was restored.";
    } catch (rollbackError) {
      rollbackMessage = ` Automatic rollback failed: ${rollbackError.message}.`;
    }
    throw new Error(`${error.message}.${rollbackMessage}`);
  }
}

export async function migrateServerImage(id) {
  const inspect = await assertControlled(id);
  assertPanelManaged(inspect);
  const targetImage = await docker.request("GET", `/images/${encodeURIComponent(config.image)}/json`);
  if (inspect.Image === targetImage.Id) {
    return { id: inspect.Id, status: "up-to-date", restarted: false, volumesPreserved: true };
  }

  const wasRunning = Boolean(inspect.State?.Running);
  const originalName = inspect.Name.replace(/^\//, "");
  const temporaryName = `${originalName}-migrate-${crypto.randomUUID().slice(0, 8)}`;
  const env = environmentMap(inspect);
  const labels = { ...(inspect.Config?.Labels || {}) };
  const port = publishedPort(inspect);
  // Pin rollback to the immutable image ID. The configured tag may already point
  // to the broken replacement image when a migration fails.
  const originalPayload = containerPayload(inspect, { env, labels, port, image: inspect.Image });
  const targetPayload = containerPayload(inspect, { env, labels, port, image: config.image });
  let replacement = null;
  let oldRemoved = false;

  try {
    replacement = await docker.request(
      "POST",
      `/containers/create?name=${encodeURIComponent(temporaryName)}`,
      targetPayload,
    );
    if (wasRunning) await docker.request("POST", `/containers/${inspect.Id}/stop?t=30`);
    await docker.request("DELETE", `/containers/${inspect.Id}?v=0`);
    oldRemoved = true;
    await docker.request("POST", `/containers/${replacement.Id}/rename?name=${encodeURIComponent(originalName)}`);
    let readiness = { state: "stopped", health: "stopped", map: null };
    if (wasRunning) {
      await docker.request("POST", `/containers/${replacement.Id}/start`);
      readiness = await waitForGameReady(replacement.Id);
    }
    await saveServerDefinition(
      await docker.request("GET", `/containers/${replacement.Id}/json`),
      wasRunning ? "running" : "stopped",
      database,
    );
    return {
      id: replacement.Id,
      status: "updated",
      previousImageId: inspect.Image,
      imageId: targetImage.Id,
      restarted: wasRunning,
      volumesPreserved: true,
      readiness,
      rollback: { attempted: false, restored: false },
    };
  } catch (error) {
    if (replacement?.Id) {
      await docker.request("DELETE", `/containers/${replacement.Id}?force=1&v=0`).catch(() => {});
    }
    if (!oldRemoved) {
      if (wasRunning) await docker.request("POST", `/containers/${inspect.Id}/start`).catch(() => {});
      throw error;
    }

    let rollbackMessage = "";
    try {
      const restored = await docker.request(
        "POST",
        `/containers/create?name=${encodeURIComponent(originalName)}`,
        originalPayload,
      );
      if (wasRunning) {
        await docker.request("POST", `/containers/${restored.Id}/start`);
        await waitForGameReady(restored.Id);
      }
      rollbackMessage = " The previous image and server configuration were restored.";
    } catch (rollbackError) {
      rollbackMessage = ` Automatic rollback failed: ${rollbackError.message}.`;
    }
    throw new Error(`${error.message}.${rollbackMessage}`);
  }
}

export async function migrateFleetImages() {
  const filters = encodeURIComponent(JSON.stringify({ label: [managedLabel] }));
  const containers = await docker.request("GET", `/containers/json?all=1&filters=${filters}`);
  const targetImage = await docker.request("GET", `/images/${encodeURIComponent(config.image)}/json`);
  const pending = [];
  for (const container of containers) {
    const inspect = await docker.request("GET", `/containers/${container.Id}/json`);
    if (inspect.Config?.Labels?.["com.cs16.managed-by"] === "panel" && inspect.Image !== targetImage.Id) {
      pending.push({
        id: inspect.Id,
        name: inspect.Config?.Labels?.["com.cs16.display-name"] || inspect.Name.replace(/^\//, ""),
      });
    }
  }

  const updated = [];
  const failed = [];
  for (const server of pending) {
    try {
      const result = await migrateServerImage(server.id);
      updated.push({ name: server.name, id: result.id });
    } catch (error) {
      failed.push({ name: server.name, error: error.message });
    }
  }
  return {
    targetImageId: targetImage.Id,
    requested: pending.length,
    updated,
    failed,
  };
}

export async function restoreServerConfiguration(id, storedEnvironment, startAfterRestore = false) {
  const inspect = await assertControlled(id);
  assertPanelManaged(inspect);
  if (!Array.isArray(storedEnvironment) || !storedEnvironment.length) throw new Error("Backup environment is missing");
  const originalEnv = environmentMap(inspect);
  const restoredEnv = new Map(
    storedEnvironment.map((entry) => {
      const separator = String(entry).indexOf("=");
      if (separator < 1) throw new Error("Backup environment contains an invalid entry");
      return [String(entry).slice(0, separator), String(entry).slice(separator + 1)];
    }),
  );
  for (const key of ["SERVER_ID", "DB_ENABLED", "DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD"]) {
    if (originalEnv.has(key)) restoredEnv.set(key, originalEnv.get(key));
  }

  const originalName = inspect.Name.replace(/^\//, "");
  const temporaryName = `${originalName}-restore-${crypto.randomUUID().slice(0, 8)}`;
  const port = publishedPort(inspect);
  const originalLabels = { ...(inspect.Config?.Labels || {}) };
  const restoredName = restoredEnv.get("SERVER_NAME") || originalLabels["com.cs16.display-name"] || originalName;
  const restoredLabels = { ...originalLabels, "com.cs16.display-name": restoredName };
  const originalPayload = containerPayload(inspect, { env: originalEnv, labels: originalLabels, port });
  const restoredPayload = containerPayload(inspect, {
    env: restoredEnv,
    labels: restoredLabels,
    port,
    image: config.image,
  });
  let replacement = null;
  let oldRemoved = false;

  try {
    replacement = await docker.request(
      "POST",
      `/containers/create?name=${encodeURIComponent(temporaryName)}`,
      restoredPayload,
    );
    await docker.request("DELETE", `/containers/${inspect.Id}?v=0`);
    oldRemoved = true;
    await docker.request("POST", `/containers/${replacement.Id}/rename?name=${encodeURIComponent(originalName)}`);
    if (startAfterRestore) await docker.request("POST", `/containers/${replacement.Id}/start`);
    await saveServerDefinition(
      await docker.request("GET", `/containers/${replacement.Id}/json`),
      startAfterRestore ? "running" : "stopped",
      database,
    );
    return { id: replacement.Id, name: restoredName, started: startAfterRestore };
  } catch (error) {
    if (replacement?.Id) {
      await docker.request("DELETE", `/containers/${replacement.Id}?force=1&v=0`).catch(() => {});
    }
    if (!oldRemoved) throw error;
    try {
      const restored = await docker.request(
        "POST",
        `/containers/create?name=${encodeURIComponent(originalName)}`,
        originalPayload,
      );
      if (startAfterRestore) await docker.request("POST", `/containers/${restored.Id}/start`);
      throw new Error(`${error.message}. The original container configuration was restored.`);
    } catch (rollbackError) {
      if (rollbackError.message.includes("original container configuration")) throw rollbackError;
      throw new Error(`${error.message}. Automatic container rollback failed: ${rollbackError.message}.`);
    }
  }
}

export async function controlledServerInspect(id) {
  return assertControlled(id);
}

export const portRange = () => [config.portStart, config.portEnd];
export { createServer, listServers };

export async function serverAction(id, action) {
  const inspect = await assertControlled(id);
  const desiredState = action === "stop" ? "stopped" : action === "pause" ? "paused" : "running";
  await saveServerDefinition(inspect, desiredState, database);
  const suffix =
    action === "stop"
      ? "/stop?t=30"
      : action === "restart"
        ? "/restart?t=30"
        : action === "pause"
          ? "/pause"
          : action === "unpause"
            ? "/unpause"
            : "/start";
  await docker.request("POST", `/containers/${inspect.Id}${suffix}`);
  if (action === "start") await applyInheritedAdmins(inspect.Id);
  return { status: action };
}

export async function serverLogs(id) {
  const inspect = await assertControlled(id);
  const logs = await docker.request("GET", `/containers/${inspect.Id}/logs?stdout=1&stderr=1&timestamps=1&tail=250`);
  return { logs: demuxDockerStream(logs) };
}

export async function getAdmins(id) {
  const inspect = await requireRunning(id);
  return readAdmins(inspect.Id, inspect);
}

export async function updateAdmins(id, input) {
  const inspect = await requireRunning(id);
  const admins = validateAdmins(input);
  if (input.scope === "fleet") {
    const updatedServers = await applyFleetAdmins(admins);
    return { source: "database-fleet", admins, reloaded: true, updatedServers };
  }
  return reloadAdmins(inspect.Id, inspect, admins, true);
}

export async function resetAdmins(id) {
  const inspect = await requireRunning(id);
  const admins = parseAdminEntries(envValue(inspect, "AMXX_ADMINS"));
  return reloadAdmins(inspect.Id, inspect, admins, false);
}

export async function getMaps(id) {
  const inspect = await requireRunning(id);
  return readMaps(inspect.Id, inspect);
}

export async function updateMaps(id, input) {
  const inspect = await requireRunning(id);
  return saveMaps(inspect.Id, inspect, input.maps);
}

export async function changeMap(id, map) {
  const inspect = await requireRunning(id);
  const { available } = await categorizedMaps(inspect.Id, inspect);
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
  return moderatePlayer(inspect.Id, inspect, Number(userId), action, input);
}

export async function removeServer(id) {
  const inspect = await assertControlled(id);
  if (inspect.Config?.Labels?.["com.cs16.managed-by"] !== "panel")
    throw new Error("Compose-managed servers cannot be removed from the panel");
  if (inspect.State?.Running) throw new Error("Stop the server before removing it");
  if (database.enabled) {
    await (
      await database.db()
    )("panel_backup_policies")
      .where({ server_id: serverKey(inspect) })
      .delete();
  }
  await docker.request("DELETE", `/containers/${inspect.Id}?v=0`);
  await deleteServerDefinition(serverKey(inspect), database);
  return { status: "removed", volumesPreserved: true };
}
