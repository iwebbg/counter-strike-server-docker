import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function storedZip(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.path);
    const content = Buffer.from(file.content);
    const crc = crc32(content);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(content.length, 18);
    local.writeUInt32LE(content.length, 22);
    local.writeUInt16LE(name.length, 26);
    localParts.push(local, name, content);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(content.length, 20);
    central.writeUInt32LE(content.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += local.length + name.length + content.length;
  }
  const centralDirectory = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralDirectory.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, centralDirectory, eocd]);
}

const origin = process.env.E2E_ORIGIN ?? "http://127.0.0.1:18080";
const api = `${origin}/api`;

class Client {
  cookie = "";

  async request(method, path, body, expected = 200) {
    const headers = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (this.cookie) headers.Cookie = this.cookie;
    if (!["GET", "HEAD"].includes(method)) headers.Origin = origin;

    const response = await fetch(`${api}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const setCookies = response.headers.getSetCookie?.() ?? [];
    if (setCookies.length) this.cookie = setCookies.map((value) => value.split(";", 1)[0]).join("; ");
    const payload = await response.json().catch(() => ({}));
    assert.equal(
      response.status,
      expected,
      `${method} ${path}: expected ${expected}, received ${response.status}: ${JSON.stringify(payload)}`,
    );
    return payload;
  }

  async login(email, password) {
    const payload = await this.request("POST", "/v1/users/signin", { email, password });
    assert.equal(payload.data.user.email, email);
    return this;
  }

  async download(path) {
    const response = await fetch(`${api}${path}`, { headers: { Cookie: this.cookie } });
    assert.equal(response.status, 200, `GET ${path}: expected a downloadable file`);
    return Buffer.from(await response.arrayBuffer());
  }
}

async function waitForServer(client, instanceId) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const payload = await client.request("GET", "/servers");
    const server = payload.data.servers.find((candidate) => candidate.serverId === instanceId);
    if (server?.state === "running") return server;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Server ${instanceId} did not enter the running state.`);
}

const owner = await new Client().login("owner@e2e.test", "e2e-owner-password");
const suffix = Date.now().toString(36);
const operators = [];
const instanceIds = new Set();

try {
  for (const role of ["admin", "moderator", "viewer"]) {
    const email = `${role}-${suffix}@e2e.test`;
    const password = `e2e-${role}-password`;
    const created = await owner.request(
      "POST",
      "/operators",
      {
        name: `E2E ${role}`,
        email,
        password,
        role,
        preferredLocale: "en",
      },
      201,
    );
    operators.push({ id: created.data.id, role, email, password, client: await new Client().login(email, password) });
  }

  const byRole = Object.fromEntries(operators.map((operator) => [operator.role, operator.client]));
  await byRole.viewer.request("GET", "/servers");
  const statsOverview = await byRole.viewer.request("GET", "/stats/overview");
  assert.ok(Array.isArray(statsOverview.data.missions));
  await byRole.admin.request("GET", "/operators", undefined, 403);

  const created = await owner.request(
    "POST",
    "/servers",
    {
      name: `E2E Classic ${suffix}`,
      mode: "classic",
      maxPlayers: 8,
      startMap: "de_dust2",
      maps: ["de_dust2", "de_inferno"],
      port: null,
      rconPassword: "e2e-rcon-password",
      serverPassword: "",
      adminSteamIds: "",
      startImmediately: true,
    },
    201,
  );
  const instanceId = created.data.instanceId;
  instanceIds.add(instanceId);
  assert.match(instanceId, /^[a-z0-9-]+$/);
  await waitForServer(owner, instanceId);

  await byRole.viewer.request("GET", `/servers/${instanceId}/players`);
  await byRole.viewer.request("GET", `/servers/${instanceId}/logs`);
  await byRole.viewer.request("POST", `/servers/${instanceId}/stop`, {}, 403);

  const maps = await byRole.moderator.request("GET", `/servers/${instanceId}/maps`);
  assert.deepEqual(maps.data.selected, ["de_dust2", "de_inferno"]);
  await byRole.moderator.request("PUT", `/servers/${instanceId}/maps`, { maps: ["de_dust2"] });
  await byRole.moderator.request("GET", `/servers/${instanceId}/admins`, undefined, 403);
  await byRole.moderator.request("POST", `/servers/${instanceId}/stop`, {}, 403);

  await byRole.viewer.request("GET", `/servers/${instanceId}/evidence`, undefined, 403);
  const evidenceStarted = await byRole.moderator.request("POST", `/servers/${instanceId}/evidence/start`, {}, 201);
  assert.match(evidenceStarted.data.filename, /^evidence-/);
  const activeEvidence = await byRole.moderator.request("GET", `/servers/${instanceId}/evidence`);
  assert.equal(activeEvidence.data.recording, true);
  await new Promise((resolve) => setTimeout(resolve, 1000));
  const evidenceStopped = await byRole.moderator.request("POST", `/servers/${instanceId}/evidence/stop`, {});
  assert.equal(evidenceStopped.data.recording, false);
  execFileSync("docker", [
    "exec",
    created.data.id,
    "sh",
    "-c",
    "mkdir -p /opt/hlds/cstrike/logs/evidence && printf 'e2e-hltv-demo' > /opt/hlds/cstrike/logs/evidence/e2e-evidence.dem",
  ]);
  const storedEvidence = await byRole.moderator.request("GET", `/servers/${instanceId}/evidence`);
  assert.ok(storedEvidence.data.recordings.some((entry) => entry.filename === "e2e-evidence.dem"));
  const demo = await byRole.moderator.download(`/servers/${instanceId}/evidence/e2e-evidence.dem`);
  assert.ok(demo.length > 0);

  await byRole.admin.request("GET", `/servers/${instanceId}/admins`);
  await byRole.admin.request("PUT", `/servers/${instanceId}/admins`, {
    scope: "server",
    admins: [{ steamId: "STEAM_0:1:123456", flags: "abcdefghijklmnopqrstu" }],
  });

  const configuration = (await byRole.admin.request("GET", `/servers/${instanceId}/configuration`)).data;
  const editableConfiguration = {
    name: configuration.name,
    mode: configuration.mode,
    maxPlayers: configuration.maxPlayers,
    startMap: configuration.startMap,
    maps: configuration.maps,
    port: configuration.port,
    rconPassword: "",
    serverPassword: "",
    clearServerPassword: false,
    welcomeMessage: "E2E control-plane test server",
    warmupEnabled: configuration.warmupEnabled,
    warmupSeconds: configuration.warmupSeconds,
    spawnProtectionEnabled: configuration.spawnProtectionEnabled,
    spawnProtectionSeconds: configuration.spawnProtectionSeconds,
    semiclipEnabled: configuration.semiclipEnabled,
    doubleJumpEnabled: configuration.doubleJumpEnabled,
    doubleJumpVelocity: configuration.doubleJumpVelocity,
    afkEnabled: configuration.afkEnabled,
    rtvEnabled: configuration.rtvEnabled,
    killstreakEnabled: configuration.killstreakEnabled,
    killstreakSoundsEnabled: configuration.killstreakSoundsEnabled,
    killstreakHudEnabled: configuration.killstreakHudEnabled,
    cpuLimit: 0.5,
    memoryLimitMb: 256,
    network: "cs16-e2e_default",
  };
  await byRole.admin.request("PUT", `/servers/${instanceId}`, editableConfiguration);
  await waitForServer(owner, instanceId);
  const limitedConfiguration = await byRole.admin.request("GET", `/servers/${instanceId}/configuration`);
  assert.equal(limitedConfiguration.data.cpuLimit, 0.5);
  assert.equal(limitedConfiguration.data.memoryLimitMb, 256);
  assert.equal(limitedConfiguration.data.network, "cs16-e2e_default");

  const exported = await byRole.admin.request("GET", `/servers/${instanceId}/configuration/export`);
  assert.equal(exported.data.schemaVersion, 1);
  assert.equal(exported.data.configuration.rconPassword, "");
  assert.equal(exported.data.configuration.serverPassword, "");
  const template = await byRole.admin.request(
    "POST",
    `/servers/${instanceId}/configuration-templates`,
    { name: `E2E template ${suffix}`, description: "Temporary E2E template" },
    201,
  );
  const templates = await byRole.admin.request("GET", "/configuration-templates");
  assert.ok(templates.data.templates.some((candidate) => candidate.id === template.data.id));

  const clone = await byRole.admin.request(
    "POST",
    `/servers/${instanceId}/clone`,
    { name: `E2E Clone ${suffix}`, port: null, startImmediately: false },
    201,
  );
  instanceIds.add(clone.data.serverId);
  const cloneConfiguration = await byRole.admin.request("GET", `/servers/${clone.data.serverId}/configuration`);
  assert.equal(cloneConfiguration.data.welcomeMessage, "E2E control-plane test server");
  await byRole.admin.request("DELETE", `/servers/${clone.data.serverId}`);
  instanceIds.delete(clone.data.serverId);
  await byRole.admin.request("DELETE", `/configuration-templates/${template.data.id}`);

  const manualBackup = await byRole.admin.request(
    "POST",
    `/servers/${instanceId}/backups`,
    {
      includeLogs: false,
      includeDatabase: false,
    },
    201,
  );
  const backups = await byRole.admin.request("GET", `/backups?serverId=${instanceId}`);
  assert.ok(backups.data.backups.length >= 1);
  await byRole.admin.request("PUT", `/servers/${instanceId}/admins`, {
    scope: "server",
    admins: [{ steamId: "STEAM_0:0:654321", flags: "bcdef" }],
  });
  await byRole.admin.request(
    "POST",
    `/servers/${instanceId}/backups/${encodeURIComponent(manualBackup.data.filename)}/restore`,
    { restoreLogs: false, restoreDatabase: false },
  );
  await waitForServer(owner, instanceId);
  const restoredAdmins = await byRole.admin.request("GET", `/servers/${instanceId}/admins`);
  assert.ok(restoredAdmins.data.admins.some((admin) => admin.steamId === "STEAM_0:1:123456"));

  const firstZip = storedZip([{ path: "maps/de_e2e_ci.bsp", content: "e2e-map-version-one" }]);
  const uploadedPackage = await byRole.admin.request(
    "POST",
    `/servers/${instanceId}/map-packages/zip`,
    { filename: "e2e-map.zip", name: "E2E map", mode: "classic", content: firstZip.toString("base64") },
    201,
  );
  const packageId = uploadedPackage.data.package.id;
  const secondZip = storedZip([{ path: "maps/de_e2e_ci.bsp", content: "e2e-map-version-two" }]);
  const replacedPackage = await byRole.admin.request(
    "POST",
    `/servers/${instanceId}/map-packages/zip`,
    {
      filename: "e2e-map-v2.zip",
      name: "E2E map v2",
      mode: "classic",
      content: secondZip.toString("base64"),
      replacePackageId: packageId,
    },
    201,
  );
  assert.equal(replacedPackage.data.status, "replaced");
  const packages = await byRole.admin.request("GET", `/servers/${instanceId}/map-packages`);
  assert.ok(packages.data.packages.some((entry) => entry.id === packageId));
  await byRole.admin.request("DELETE", `/servers/${instanceId}/map-packages/${packageId}`);
  const defaultPolicy = await byRole.admin.request("GET", `/servers/${instanceId}/backup-policy`);
  assert.equal(defaultPolicy.data.enabled, false);
  assert.equal(defaultPolicy.data.remoteConfigured, false);
  const savedPolicy = await byRole.admin.request("PUT", `/servers/${instanceId}/backup-policy`, {
    enabled: true,
    intervalHours: 24,
    retentionCount: 2,
    includeLogs: false,
    includeDatabase: false,
    remoteEnabled: false,
  });
  assert.equal(savedPolicy.data.enabled, true);
  await byRole.admin.request("POST", `/servers/${instanceId}/backup-policy/run`, {}, 201);
  const scheduledBackups = await byRole.admin.request("GET", `/backups?serverId=${instanceId}`);
  assert.ok(scheduledBackups.data.backups.some((backup) => backup.kind === "scheduled"));
  const completedPolicy = await byRole.admin.request("GET", `/servers/${instanceId}/backup-policy`);
  assert.equal(completedPolicy.data.lastStatus, "success");
  assert.ok(completedPolicy.data.nextRunAt);
  const season = await owner.request("POST", "/seasons", { name: `E2E Season ${suffix}` }, 201);
  assert.equal(season.data.active, true);
  await byRole.moderator.request("GET", "/bans");
  await byRole.moderator.request("GET", "/moderation/history");
  const history = await byRole.admin.request("GET", `/servers/${instanceId}/configuration-history`);
  assert.equal(history.data.revisions.length, 2);
  assert.equal(history.data.revisions[1].reason, "baseline");
  await byRole.admin.request("POST", `/servers/${instanceId}/configuration-history/1/rollback`, {});
  await waitForServer(owner, instanceId);
  const rolledBack = await byRole.admin.request("GET", `/servers/${instanceId}/configuration`);
  assert.notEqual(rolledBack.data.welcomeMessage, "E2E control-plane test server");
  const rotatedRcon = await byRole.admin.request("POST", `/servers/${instanceId}/rcon/rotate`, {});
  assert.equal(rotatedRcon.data.shownOnce, true);
  assert.ok(rotatedRcon.data.rconPassword.length >= 32);
  await waitForServer(owner, instanceId);

  execFileSync("docker", ["image", "tag", "cs16-server:e2e-target", "cs16-server:e2e-good"]);
  execFileSync("docker", ["image", "tag", "redis:8.4-alpine", "cs16-server:e2e-target"]);
  try {
    await byRole.admin.request("PUT", `/servers/${instanceId}/image`, {}, 500);
    await waitForServer(owner, instanceId);
  } finally {
    execFileSync("docker", ["image", "tag", "cs16-server:e2e-good", "cs16-server:e2e-target"]);
  }
  await byRole.admin.request("GET", "/audit-logs?limit=20");

  await byRole.admin.request("POST", `/servers/${instanceId}/stop`, {});
  await byRole.admin.request("DELETE", `/servers/${instanceId}`);
  instanceIds.delete(instanceId);

  console.log("E2E control-plane checks passed for owner, admin, moderator and viewer.");
} finally {
  for (const instanceId of instanceIds) {
    await owner.request("POST", `/servers/${instanceId}/stop`, {}).catch(() => {});
    await owner.request("DELETE", `/servers/${instanceId}`).catch(() => {});
  }
  for (const operator of operators.reverse()) {
    await owner.request("DELETE", `/operators/${operator.id}`).catch(() => {});
  }
}
