import assert from "node:assert/strict";

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
  await byRole.viewer.request("GET", "/stats/overview");
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

  await byRole.admin.request(
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
