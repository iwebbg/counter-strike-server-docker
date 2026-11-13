import assert from "node:assert/strict";
import test from "node:test";
import {
  definitionCreatePayload,
  definitionDesiredState,
  definitionServerId,
  reconcileServerDefinitions,
} from "../src/controllers/servers/services/ServerDefinitionService.mjs";

function sampleInspect() {
  return {
    Id: "a".repeat(64),
    Name: "/cs16-instance-recover1",
    Config: {
      Image: "cs16-server:old",
      Env: ["SERVER_ID=recover1", "SERVER_NAME=Recovery test", "RCON_PASSWORD=secret"],
      Labels: {
        "com.cs16.controlled": "true",
        "com.cs16.managed-by": "panel",
        "com.cs16.instance-id": "recover1",
      },
      ExposedPorts: { "27015/udp": {}, "27015/tcp": {} },
      Healthcheck: { Test: ["CMD-SHELL", "true"] },
      StopTimeout: 30,
    },
    State: { Running: true },
    HostConfig: {
      PortBindings: {
        "27015/udp": [{ HostIp: "0.0.0.0", HostPort: "27016" }],
        "27015/tcp": [{ HostIp: "0.0.0.0", HostPort: "27016" }],
      },
      RestartPolicy: { Name: "unless-stopped", MaximumRetryCount: 0 },
      NanoCpus: 500_000_000,
      Memory: 512 * 1024 * 1024,
    },
    Mounts: [
      { Type: "volume", Name: "cs16_recover1_logs", Destination: "/opt/hlds/cstrike/logs", RW: true },
      {
        Type: "volume",
        Name: "cs16_recover1_data",
        Destination: "/opt/hlds/cstrike/addons/amxmodx/data",
        RW: true,
      },
    ],
    NetworkSettings: { Networks: { cs16_default: {} } },
  };
}

function memoryDatabase(initialRows) {
  const rows = initialRows.map((row) => ({ ...row }));
  const table = () => {
    let where = null;
    const matching = () =>
      rows.filter((row) => !where || Object.entries(where).every(([key, value]) => row[key] === value));
    return {
      select: async (...columns) =>
        matching().map((row) => Object.fromEntries(columns.map((column) => [column, row[column]]))),
      where(values) {
        where = values;
        return this;
      },
      then(resolve, reject) {
        return Promise.resolve(matching()).then(resolve, reject);
      },
      update: async (values) => {
        for (const row of matching()) Object.assign(row, values);
      },
      insert(values) {
        return {
          onConflict() {
            return this;
          },
          async merge(mergedValues) {
            const existing = rows.find((row) => row.server_id === values.server_id);
            if (existing) Object.assign(existing, mergedValues);
            else rows.push({ ...values });
          },
        };
      },
    };
  };
  return { enabled: true, rows, db: async () => table };
}

test("serializes a panel server into a restart-safe Docker definition", () => {
  const inspect = sampleInspect();
  assert.equal(definitionServerId(inspect), "recover1");
  assert.equal(definitionDesiredState(inspect), "running");
  const payload = definitionCreatePayload(inspect);
  assert.equal(payload.HostConfig.RestartPolicy.Name, "unless-stopped");
  assert.equal(payload.HostConfig.PortBindings["27015/udp"][0].HostPort, "27016");
  assert.deepEqual(
    payload.HostConfig.Mounts.map((mount) => mount.Source),
    ["cs16_recover1_logs", "cs16_recover1_data"],
  );
  assert.deepEqual(Object.keys(payload.NetworkingConfig.EndpointsConfig), ["cs16_default"]);
});

test("preserves the paused desired state", () => {
  const inspect = sampleInspect();
  inspect.State.Paused = true;
  assert.equal(definitionDesiredState(inspect), "paused");
});

test("recreates a missing running server from its persisted definition", async () => {
  const inspect = sampleInspect();
  const database = memoryDatabase([
    {
      server_id: "recover1",
      container_name: "cs16-instance-recover1",
      create_payload: JSON.stringify(definitionCreatePayload(inspect)),
      desired_state: "running",
      enabled: true,
    },
  ]);
  const calls = [];
  let startAttempts = 0;
  const docker = {
    request: async (method, path, body) => {
      calls.push({ method, path, body });
      if (method === "GET" && path.startsWith("/containers/json")) return [];
      if (method === "POST" && path === "/volumes/create") return { Name: body.Name };
      if (method === "POST" && path.startsWith("/containers/create")) return { Id: "restored-container" };
      if (method === "POST" && path === "/containers/restored-container/start") {
        startAttempts += 1;
        if (startAttempts === 1) throw new Error("Temporary Docker start failure");
        return {};
      }
      throw new Error(`Unexpected Docker request: ${method} ${path}`);
    },
  };
  const result = await reconcileServerDefinitions({
    database,
    docker,
    image: "cs16-server:local",
    defaultNetwork: "cs16_default",
    allowedNetworks: ["cs16_default"],
  });
  assert.deepEqual(result.restored, ["recover1"]);
  assert.equal(result.failed.length, 0);
  const create = calls.find((call) => call.path.startsWith("/containers/create"));
  assert.equal(create.body.Image, "cs16-server:local");
  assert.equal(create.body.HostConfig.RestartPolicy.Name, "unless-stopped");
  assert.ok(calls.some((call) => call.path === "/containers/restored-container/start"));
  assert.equal(startAttempts, 2);
  assert.equal(database.rows[0].container_id, "restored-container");
});

test("enforces a stopped definition when its container is unexpectedly running", async () => {
  const inspect = sampleInspect();
  const database = memoryDatabase([
    {
      server_id: "recover1",
      container_name: "cs16-instance-recover1",
      create_payload: JSON.stringify(definitionCreatePayload(inspect)),
      desired_state: "stopped",
      enabled: true,
    },
  ]);
  const calls = [];
  const docker = {
    request: async (method, path) => {
      calls.push({ method, path });
      if (method === "GET" && path.startsWith("/containers/json")) return [{ Id: inspect.Id }];
      if (method === "GET" && path === `/containers/${inspect.Id}/json`) return inspect;
      if (method === "POST" && path === `/containers/${inspect.Id}/stop?t=30`) return {};
      throw new Error(`Unexpected Docker request: ${method} ${path}`);
    },
  };
  const result = await reconcileServerDefinitions({ database, docker });
  assert.deepEqual(result.existing, ["recover1"]);
  assert.ok(calls.some((call) => call.path === `/containers/${inspect.Id}/stop?t=30`));
});
