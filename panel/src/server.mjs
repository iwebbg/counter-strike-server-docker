import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { queryA2S } from './a2s.mjs';
import { createDatabase } from './database.mjs';
import { DockerClient, DockerError, demuxDockerStream } from './docker.mjs';
import { parseStatusPlayers, rconCommand } from './rcon.mjs';
import { activeBans, createSeason, globalAdmins, moderationHistory, playerProfile, recordModeration, revokeBan, statsOverview, syncDatabaseAdmins, syncGlobalAdmins, syncServerRegistry, validateStatsFilter } from './stats.mjs';
import { parseAdminEntries, parseInteger, validateAdmins, validateCreateInput, validateMapList, validateModerationInput } from './validation.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'public');
const config = {
  listenPort: parseInteger(process.env.PANEL_PORT || 8080, 'PANEL_PORT', 1, 65535),
  token: process.env.PANEL_TOKEN || '',
  image: process.env.SERVER_IMAGE || 'cs16-server:local',
  network: process.env.PANEL_NETWORK || 'cs16_default',
  portStart: parseInteger(process.env.PORT_RANGE_START || 27015, 'PORT_RANGE_START', 1024, 65535),
  portEnd: parseInteger(process.env.PORT_RANGE_END || 27115, 'PORT_RANGE_END', 1024, 65535),
  dbEnabled: process.env.DB_ENABLED === '1',
  dbHost: process.env.DB_HOST || 'mariadb',
  dbName: process.env.DB_NAME || 'cs16',
  dbUser: process.env.DB_USER || 'cs16',
  dbPassword: process.env.DB_PASSWORD || '',
  killstreakEnabled: process.env.KILLSTREAK_ENABLED || '1',
  killstreakSounds: process.env.KILLSTREAK_SOUNDS_ENABLED || '1',
  killstreakHud: process.env.KILLSTREAK_HUD_ENABLED || '1',
  killstreakGlobal: process.env.KILLSTREAK_GLOBAL || '1',
  killstreakWindow: process.env.KILLSTREAK_MULTI_WINDOW || '4.0',
};

if (config.token.length < 16) {
  console.error('[panel] PANEL_TOKEN must contain at least 16 characters');
  process.exit(1);
}
if (config.portStart > config.portEnd) {
  console.error('[panel] PORT_RANGE_START must not be greater than PORT_RANGE_END');
  process.exit(1);
}

const docker = new DockerClient();
const database = createDatabase();
const managedLabel = 'com.cs16.controlled=true';
const managedAdminsFile = '/opt/hlds/cstrike/addons/amxmodx/data/panel_admins.txt';
const usersFile = '/opt/hlds/cstrike/addons/amxmodx/configs/users.ini';
const managedMapcycleFile = '/opt/hlds/cstrike/addons/amxmodx/data/panel_mapcycle.txt';
const mapcycleFile = '/opt/hlds/cstrike/mapcycle.txt';
const amxxMapsFile = '/opt/hlds/cstrike/addons/amxmodx/configs/maps.ini';
const moderationLog = '/opt/hlds/cstrike/addons/amxmodx/data/panel_moderation.log';

function sendJson(response, status, data) {
  const body = JSON.stringify(data);
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(body) });
  response.end(body);
}

function safeEqual(left, right) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function isAuthorized(request) {
  const header = request.headers.authorization || '';
  return header.startsWith('Bearer ') && safeEqual(header.slice(7), config.token);
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 64 * 1024) throw new Error('Request body is too large');
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    throw new Error('Invalid JSON body');
  }
}

function envValue(inspect, name, fallback = '') {
  const prefix = `${name}=`;
  const entry = (inspect.Config.Env || []).find((value) => value.startsWith(prefix));
  return entry ? entry.slice(prefix.length) : fallback;
}

function serverKey(inspect) {
  return envValue(inspect, 'SERVER_ID') || inspect.Config?.Labels?.['com.cs16.instance-id'] || inspect.Id.slice(0, 12);
}

function publishedPort(inspect) {
  const bindings = inspect.HostConfig?.PortBindings?.['27015/udp'];
  return bindings?.[0]?.HostPort ? Number(bindings[0].HostPort) : null;
}

function containerAddress(inspect) {
  const networks = inspect.NetworkSettings?.Networks || {};
  return networks[config.network]?.IPAddress || Object.values(networks).find((network) => network.IPAddress)?.IPAddress || '';
}

async function assertControlled(id) {
  if (!/^[a-f0-9]{12,64}$/.test(id)) throw new Error('Invalid server id');
  const inspect = await docker.request('GET', `/containers/${id}/json`);
  if (inspect.Config?.Labels?.['com.cs16.controlled'] !== 'true') throw new Error('Container is not managed by CS Control');
  return inspect;
}

async function runExec(containerId, command) {
  const created = await docker.request('POST', `/containers/${containerId}/exec`, {
    AttachStdout: true,
    AttachStderr: true,
    Tty: false,
    User: 'hlds',
    Cmd: command,
  });
  const output = await docker.request('POST', `/exec/${created.Id}/start`, { Detach: false, Tty: false });
  const result = await docker.request('GET', `/exec/${created.Id}/json`);
  const text = demuxDockerStream(output);
  if (result.ExitCode !== 0) throw new Error(text.trim() || `Container command failed (${result.ExitCode})`);
  return text;
}

function serializeAdmins(admins) {
  return admins.map(({ steamId, flags }) => `${steamId}|${flags}`).join(';');
}

function usersFileContent(admins) {
  const lines = [
    '; Managed live by CS Control.',
    '; SteamID authentication is used, so no admin passwords are stored.',
    '"loopback" "" "abcdefghijklmnopqrstu" "de"',
    ...admins.map(({ steamId, flags }) => `"${steamId}" "" "${flags}" "ce"`),
  ];
  return `${lines.join('\n')}\n`;
}

async function requireRunning(id) {
  const inspect = await assertControlled(id);
  if (!inspect.State?.Running) throw new Error('Start the server before using live management');
  return inspect;
}

async function installedMaps(id) {
  const output = await runExec(id, ['sh', '-c', 'for file in /opt/hlds/cstrike/maps/*.bsp; do [ -f "$file" ] || continue; name=${file##*/}; printf "%s\\n" "${name%.bsp}"; done']);
  return output.split('\n').map((map) => map.trim()).filter((map) => /^[a-zA-Z0-9_]+$/.test(map)).sort((left, right) => left.localeCompare(right));
}

async function categorizedMaps(id, inspect) {
  const mode = envValue(inspect, 'SERVER_MODE', 'classic');
  if (mode !== 'classic' && mode !== 'gungame') throw new Error(`Unsupported server mode: ${mode}`);
  const presetFile = `/opt/hlds/presets/maps/${mode}.txt`;
  const [installed, preset] = await Promise.all([
    installedMaps(id),
    runExec(id, ['sh', '-c', 'cat "$1"', 'map-category', presetFile]),
  ]);
  const category = preset.split('\n').map((map) => map.trim()).filter((map) => /^[a-zA-Z0-9_]+$/.test(map));
  return { mode, available: category.filter((map) => installed.includes(map)) };
}

async function readMaps(id, inspect) {
  const { mode, available } = await categorizedMaps(id, inspect);
  const output = await runExec(id, ['sh', '-c', `if [ -f '${managedMapcycleFile}' ]; then printf 'panel\\n'; cat '${managedMapcycleFile}'; else printf 'runtime\\n'; cat '${mapcycleFile}'; fi`]);
  const newline = output.indexOf('\n');
  const source = newline === -1 ? 'runtime' : output.slice(0, newline).trim();
  const selected = output.slice(newline + 1).split('\n').map((map) => map.trim()).filter((map) => available.includes(map));
  const address = containerAddress(inspect);
  const game = address ? await queryA2S(address, 27015).catch(() => null) : null;
  return { source, mode, available, selected, current: game?.map || null };
}

async function saveMaps(id, inspect, maps) {
  const { mode, available } = await categorizedMaps(id, inspect);
  const missing = maps.filter((map) => !available.includes(map));
  if (missing.length) throw new Error(`Maps do not belong to the ${mode} category or are not installed: ${missing.join(', ')}`);
  const mapcycle = `${maps.join('\n')}\n`;
  const script = `printf '%s' "$1" > '${managedMapcycleFile}' && printf '%s' "$1" > '${mapcycleFile}' && printf '%s' "$1" > '${amxxMapsFile}'`;
  await runExec(id, ['sh', '-c', script, 'map-sync', mapcycle]);
  return { source: 'panel', mode, available, selected: maps, synchronized: true };
}

async function livePlayers(inspect) {
  const output = await rconCommand(containerAddress(inspect), 27015, envValue(inspect, 'RCON_PASSWORD'), 'status');
  return parseStatusPlayers(output);
}

async function writeModerationAudit(id, event) {
  const entry = JSON.stringify({ timestamp: new Date().toISOString(), ...event });
  await runExec(id, ['sh', '-c', `printf '%s\\n' "$1" >> '${moderationLog}'`, 'moderation-audit', entry]);
}

async function moderatePlayer(id, inspect, userId, action, input) {
  const player = (await livePlayers(inspect)).find((entry) => entry.userId === userId);
  if (!player) throw new Error(`Player userid ${userId} is no longer connected`);
  const values = validateModerationInput(input, action);
  const address = containerAddress(inspect);
  const password = envValue(inspect, 'RCON_PASSWORD');
  if (action === 'ban' && !/^STEAM_[0-9]+:[01]:[0-9]+$/.test(player.steamId)) throw new Error('Player does not have a bannable Steam ID');
  const centralBan = action === 'ban' && database.enabled;

  if (centralBan) {
    await recordModeration(database, { serverId: serverKey(inspect), action, steamId: player.steamId, name: player.name, ...values });
  }

  if (action === 'kick') {
    await rconCommand(address, 27015, password, `amx_kick #${userId} "${values.reason}"`);
  } else {
    if (database.enabled) {
      await rconCommand(address, 27015, password, `amx_kick #${userId} "${values.reason}"`);
    } else {
      await rconCommand(address, 27015, password, `amx_ban ${values.minutes} #${userId} "${values.reason}"`);
      await rconCommand(address, 27015, password, 'writeid');
    }
  }

  await writeModerationAudit(id, { action, userId, steamId: player.steamId, name: player.name, ...values });
  if (!centralBan) {
    await recordModeration(database, { serverId: serverKey(inspect), action, steamId: player.steamId, name: player.name, ...values });
  }
  return { status: action === 'kick' ? 'kicked' : 'banned', player: { name: player.name, steamId: player.steamId }, ...values };
}

async function readAdmins(id, inspect) {
  const output = await runExec(id, ['sh', '-c', `if [ -f '${managedAdminsFile}' ]; then printf 'panel\\n'; cat '${managedAdminsFile}'; else printf 'environment\\n'; printf '%s' "$AMXX_ADMINS"; fi`]);
  const newline = output.indexOf('\n');
  const source = newline === -1 ? 'environment' : output.slice(0, newline).trim();
  const raw = newline === -1 ? envValue(inspect, 'AMXX_ADMINS') : output.slice(newline + 1).trim();
  return { source, admins: parseAdminEntries(raw) };
}

async function reloadAdmins(id, inspect, admins, persist) {
  const serialized = serializeAdmins(admins);
  const users = usersFileContent(admins);
  const script = persist
    ? `printf '%s' "$1" > '${managedAdminsFile}' && printf '%s' "$2" > '${usersFile}'`
    : `rm -f '${managedAdminsFile}' && printf '%s' "$1" > '${usersFile}'`;
  const args = persist ? [script, 'admin-sync', serialized, users] : [script, 'admin-sync', users];
  await runExec(id, ['sh', '-c', ...args]);
  const address = containerAddress(inspect);
  const reloadOutput = await rconCommand(address, 27015, envValue(inspect, 'RCON_PASSWORD'), 'amx_reloadadmins');
  await syncDatabaseAdmins(database, serverKey(inspect), admins);
  return { source: persist ? 'panel' : 'environment', admins, reloaded: true, output: reloadOutput };
}

function mergeAdmins(...lists) {
  return [...new Map(lists.flat().map((admin) => [admin.steamId, admin])).values()];
}

async function applyFleetAdmins(admins) {
  await syncGlobalAdmins(database, admins);
  const filters = encodeURIComponent(JSON.stringify({ label: [managedLabel] }));
  const containers = await docker.request('GET', `/containers/json?filters=${filters}`);
  let updated = 0;
  for (const container of containers) {
    const inspect = await docker.request('GET', `/containers/${container.Id}/json`);
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
  const containers = await docker.request('GET', `/containers/json?all=1&filters=${filters}`);

  const servers = await Promise.all(containers.map(async (container) => {
    const inspect = await docker.request('GET', `/containers/${container.Id}/json`);
    let game = null;
    if (inspect.State?.Running) {
      const address = containerAddress(inspect);
      if (address) game = await queryA2S(address, 27015).catch(() => null);
    }
    return {
      id: container.Id,
      serverId: serverKey(inspect),
      name: inspect.Config?.Labels?.['com.cs16.display-name'] || inspect.Name.replace(/^\//, ''),
      containerName: inspect.Name.replace(/^\//, ''),
      managedBy: inspect.Config?.Labels?.['com.cs16.managed-by'] || 'unknown',
      mode: envValue(inspect, 'SERVER_MODE', 'classic'),
      maxPlayers: Number(envValue(inspect, 'MAX_PLAYERS', 24)),
      startMap: envValue(inspect, 'START_MAP', ''),
      port: publishedPort(inspect),
      state: inspect.State?.Status || 'unknown',
      health: inspect.State?.Health?.Status || (inspect.State?.Running ? 'running' : 'stopped'),
      players: game?.players ?? null,
      liveMaxPlayers: game?.maxPlayers ?? null,
      map: game?.map || null,
      startedAt: inspect.State?.StartedAt || null,
    };
  }));
  await syncServerRegistry(database, servers).catch((error) => console.error('[panel] registry sync failed:', error.message));
  return servers;
}

async function usedPorts() {
  const containers = await docker.request('GET', '/containers/json?all=1');
  const inspections = await Promise.all(containers.map((container) => docker.request('GET', `/containers/${container.Id}/json`)));
  const ports = inspections.flatMap((inspect) => Object.values(inspect.HostConfig?.PortBindings || {})
    .flatMap((bindings) => (bindings || []).map((binding) => Number(binding.HostPort)).filter(Boolean)));
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
  throw new Error('No free game ports remain in the configured range');
}

async function ensureVolume(name) {
  await docker.request('POST', '/volumes/create', { Name: name, Labels: { 'com.cs16.controlled': 'true' } });
}

async function createServer(input) {
  const values = validateCreateInput(input, config.portStart, config.portEnd);
  const port = await selectPort(values.port);
  const instanceId = crypto.randomUUID().slice(0, 8);
  const containerName = `cs16-instance-${instanceId}`;
  const volumePrefix = `cs16_${instanceId}`;
  const rconPassword = values.rconPassword || crypto.randomBytes(18).toString('base64url');
  const inheritedAdmins = await globalAdmins(database);
  const requestedAdmins = values.adminSteamIds.map((steamId) => ({ steamId, flags: 'abcdefghijklmnopqrstu' }));
  const adminMap = new Map([...inheritedAdmins, ...requestedAdmins].map((admin) => [admin.steamId, admin]));
  const initialAdmins = [...adminMap.values()];

  await ensureVolume(`${volumePrefix}_logs`);
  await ensureVolume(`${volumePrefix}_data`);

  const container = await docker.request('POST', `/containers/create?name=${containerName}`, {
    Image: config.image,
    Env: [
      `SERVER_MODE=${values.mode}`,
      `SERVER_NAME=${values.name}`,
      `MAX_PLAYERS=${values.maxPlayers}`,
      `START_MAP=${values.startMap}`,
      `MAPCYCLE=${values.maps.join(',')}`,
      `RCON_PASSWORD=${rconPassword}`,
      `SERVER_PASSWORD=${values.serverPassword}`,
      'WARMUP_ENABLED=1',
      'WARMUP_SECONDS=45',
      `SPAWN_PROTECTION_ENABLED=${values.mode === 'gungame' ? 1 : 0}`,
      'SPAWN_PROTECTION_SECONDS=3.0',
      'SEMICLIP_ENABLED=1',
      'AFK_MANAGER_ENABLED=1',
      'AFK_WARN_SECONDS=60',
      'AFK_SPECTATOR_SECONDS=90',
      'AFK_KICK_SECONDS=180',
      'RTV_ENABLED=1',
      'RTV_RATIO=0.60',
      'RTV_MIN_VOTES=2',
      'RTV_DELAY_SECONDS=120',
      'RECENT_MAPS=3',
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
      'com.cs16.controlled': 'true',
      'com.cs16.managed-by': 'panel',
      'com.cs16.instance-id': instanceId,
      'com.cs16.display-name': values.name,
    },
    ExposedPorts: { '27015/udp': {}, '27015/tcp': {} },
    Healthcheck: {
      Test: ['CMD-SHELL', 'pgrep -x hlds_linux >/dev/null'],
      Interval: 30_000_000_000,
      Timeout: 5_000_000_000,
      Retries: 5,
      StartPeriod: 90_000_000_000,
    },
    HostConfig: {
      PortBindings: {
        '27015/udp': [{ HostIp: '0.0.0.0', HostPort: String(port) }],
        '27015/tcp': [{ HostIp: '0.0.0.0', HostPort: String(port) }],
      },
      RestartPolicy: { Name: 'unless-stopped', MaximumRetryCount: 0 },
      StopTimeout: 30,
      Mounts: [
        { Type: 'volume', Source: `${volumePrefix}_logs`, Target: '/opt/hlds/cstrike/logs' },
        { Type: 'volume', Source: `${volumePrefix}_data`, Target: '/opt/hlds/cstrike/addons/amxmodx/data' },
      ],
    },
    NetworkingConfig: { EndpointsConfig: { [config.network]: {} } },
  });

  if (values.startImmediately) await docker.request('POST', `/containers/${container.Id}/start`);
  return { id: container.Id, instanceId, port, rconPassword, started: values.startImmediately };
}

async function serveStatic(requestPath, response) {
  const files = {
    '/': ['index.html', 'text/html; charset=utf-8'],
    '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
    '/i18n.js': ['i18n.js', 'text/javascript; charset=utf-8'],
    '/styles.css': ['styles.css', 'text/css; charset=utf-8'],
  };
  const target = files[requestPath];
  if (!target) return false;
  const content = await fs.readFile(path.join(publicDir, target[0]));
  response.writeHead(200, {
    'content-type': target[1],
    'content-length': content.length,
    'cache-control': 'no-store',
    'content-security-policy': "default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'",
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
  });
  response.end(content);
  return true;
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://panel.local');
    if (request.method === 'GET' && url.pathname === '/api/health') {
      sendJson(response, 200, { status: 'ok' });
      return;
    }
    if (!url.pathname.startsWith('/api/')) {
      if (!await serveStatic(url.pathname, response)) sendJson(response, 404, { error: 'Not found' });
      return;
    }
    if (!isAuthorized(request)) {
      sendJson(response, 401, { error: 'Invalid panel token' });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/database/status') {
      sendJson(response, 200, await database.status());
      return;
    }
    if (request.method === 'GET' && url.pathname === '/api/stats/overview') {
      sendJson(response, 200, await statsOverview(database, validateStatsFilter(url)));
      return;
    }
    const playerStatsMatch = url.pathname.match(/^\/api\/stats\/players\/(STEAM_[0-9]+:[01]:[0-9]+)$/);
    if (request.method === 'GET' && playerStatsMatch) {
      sendJson(response, 200, await playerProfile(database, playerStatsMatch[1]));
      return;
    }
    if (request.method === 'GET' && url.pathname === '/api/moderation/history') {
      sendJson(response, 200, { actions: await moderationHistory(database) });
      return;
    }
    if (request.method === 'GET' && url.pathname === '/api/bans') {
      sendJson(response, 200, { bans: await activeBans(database) });
      return;
    }
    const revokeBanMatch = url.pathname.match(/^\/api\/bans\/(\d+)\/revoke$/);
    if (request.method === 'POST' && revokeBanMatch) {
      sendJson(response, 200, await revokeBan(database, Number(revokeBanMatch[1])));
      return;
    }
    if (request.method === 'POST' && url.pathname === '/api/seasons') {
      sendJson(response, 201, await createSeason(database, await readJson(request)));
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/servers') {
      sendJson(response, 200, { servers: await listServers(), portRange: [config.portStart, config.portEnd] });
      return;
    }
    if (request.method === 'POST' && url.pathname === '/api/servers') {
      sendJson(response, 201, await createServer(await readJson(request)));
      return;
    }

    const actionMatch = url.pathname.match(/^\/api\/servers\/([a-f0-9]{12,64})\/(start|stop|restart)$/);
    if (request.method === 'POST' && actionMatch) {
      const [, id, action] = actionMatch;
      await assertControlled(id);
      const suffix = action === 'stop' ? '/stop?t=30' : action === 'restart' ? '/restart?t=30' : '/start';
      await docker.request('POST', `/containers/${id}${suffix}`);
      if (action === 'start') await applyInheritedAdmins(id);
      sendJson(response, 200, { status: action });
      return;
    }

    const logsMatch = url.pathname.match(/^\/api\/servers\/([a-f0-9]{12,64})\/logs$/);
    if (request.method === 'GET' && logsMatch) {
      await assertControlled(logsMatch[1]);
      const logs = await docker.request('GET', `/containers/${logsMatch[1]}/logs?stdout=1&stderr=1&timestamps=1&tail=250`);
      sendJson(response, 200, { logs: demuxDockerStream(logs) });
      return;
    }

    const adminsMatch = url.pathname.match(/^\/api\/servers\/([a-f0-9]{12,64})\/admins$/);
    if (adminsMatch && request.method === 'GET') {
      const inspect = await requireRunning(adminsMatch[1]);
      sendJson(response, 200, await readAdmins(adminsMatch[1], inspect));
      return;
    }
    if (adminsMatch && request.method === 'PUT') {
      const inspect = await requireRunning(adminsMatch[1]);
      const input = await readJson(request);
      const admins = validateAdmins(input);
      if (input.scope === 'fleet') {
        const updatedServers = await applyFleetAdmins(admins);
        sendJson(response, 200, { source: 'database-fleet', admins, reloaded: true, updatedServers });
      } else {
        sendJson(response, 200, await reloadAdmins(adminsMatch[1], inspect, admins, true));
      }
      return;
    }
    if (adminsMatch && request.method === 'DELETE') {
      const inspect = await requireRunning(adminsMatch[1]);
      const admins = parseAdminEntries(envValue(inspect, 'AMXX_ADMINS'));
      sendJson(response, 200, await reloadAdmins(adminsMatch[1], inspect, admins, false));
      return;
    }

    const mapsMatch = url.pathname.match(/^\/api\/servers\/([a-f0-9]{12,64})\/maps$/);
    if (mapsMatch && request.method === 'GET') {
      const inspect = await requireRunning(mapsMatch[1]);
      sendJson(response, 200, await readMaps(mapsMatch[1], inspect));
      return;
    }
    if (mapsMatch && request.method === 'PUT') {
      const inspect = await requireRunning(mapsMatch[1]);
      const maps = validateMapList((await readJson(request)).maps, 'Map rotation');
      sendJson(response, 200, await saveMaps(mapsMatch[1], inspect, maps));
      return;
    }

    const changeMapMatch = url.pathname.match(/^\/api\/servers\/([a-f0-9]{12,64})\/maps\/change$/);
    if (changeMapMatch && request.method === 'POST') {
      const inspect = await requireRunning(changeMapMatch[1]);
      const map = validateMapList([(await readJson(request)).map], 'Map selection')[0];
      const { mode, available } = await categorizedMaps(changeMapMatch[1], inspect);
      if (!available.includes(map)) throw new Error(`Map does not belong to the ${mode} category or is not installed: ${map}`);
      const output = await rconCommand(containerAddress(inspect), 27015, envValue(inspect, 'RCON_PASSWORD'), `changelevel ${map}`);
      sendJson(response, 200, { status: 'changing', mode, map, output });
      return;
    }

    const playersMatch = url.pathname.match(/^\/api\/servers\/([a-f0-9]{12,64})\/players$/);
    if (playersMatch && request.method === 'GET') {
      const inspect = await requireRunning(playersMatch[1]);
      sendJson(response, 200, { players: await livePlayers(inspect) });
      return;
    }

    const moderationMatch = url.pathname.match(/^\/api\/servers\/([a-f0-9]{12,64})\/players\/(\d+)\/(kick|ban)$/);
    if (moderationMatch && request.method === 'POST') {
      const [, id, rawUserId, action] = moderationMatch;
      const inspect = await requireRunning(id);
      sendJson(response, 200, await moderatePlayer(id, inspect, Number(rawUserId), action, await readJson(request)));
      return;
    }

    const deleteMatch = url.pathname.match(/^\/api\/servers\/([a-f0-9]{12,64})$/);
    if (request.method === 'DELETE' && deleteMatch) {
      const inspect = await assertControlled(deleteMatch[1]);
      if (inspect.Config?.Labels?.['com.cs16.managed-by'] !== 'panel') throw new Error('Compose-managed servers cannot be removed from the panel');
      if (inspect.State?.Running) throw new Error('Stop the server before removing it');
      await docker.request('DELETE', `/containers/${deleteMatch[1]}?v=0`);
      sendJson(response, 200, { status: 'removed', volumesPreserved: true });
      return;
    }

    sendJson(response, 404, { error: 'API route not found' });
  } catch (error) {
    console.error('[panel]', error);
    const clientError = !(error instanceof DockerError) || (error.statusCode >= 400 && error.statusCode < 500);
    sendJson(response, clientError ? 400 : 502, { error: error.details || error.message || 'Unexpected error' });
  }
});

server.listen(config.listenPort, '0.0.0.0', () => {
  console.log(`[panel] CS Control listening on port ${config.listenPort}; game ports ${config.portStart}-${config.portEnd}`);
});

function shutdown(signal) {
  console.log(`[panel] ${signal} received, closing HTTP server`);
  server.close(async () => {
    await database.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000).unref();
}

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
