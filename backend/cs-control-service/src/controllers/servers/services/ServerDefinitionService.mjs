import { DockerClient } from "../../../infrastructure/Docker.mjs";
import Db from "../../../utils/Db.mjs";

const controlledLabel = "com.cs16.controlled=true";
const panelManagedLabel = "panel";

async function requestStateChange(docker, path, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await docker.request("POST", path);
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, attempt * 300));
    }
  }
  throw lastError;
}

function envValue(inspect, name) {
  const prefix = `${name}=`;
  return (inspect.Config?.Env || []).find((entry) => entry.startsWith(prefix))?.slice(prefix.length) || "";
}

export function definitionServerId(inspect) {
  return envValue(inspect, "SERVER_ID") || inspect.Config?.Labels?.["com.cs16.instance-id"] || inspect.Id.slice(0, 12);
}

export function definitionDesiredState(inspect) {
  if (inspect.State?.Paused) return "paused";
  return inspect.State?.Running ? "running" : "stopped";
}

export function definitionCreatePayload(inspect) {
  const mounts = (inspect.Mounts || [])
    .filter((mount) => ["volume", "bind"].includes(mount.Type))
    .map((mount) => ({
      Type: mount.Type,
      Source: mount.Name || mount.Source,
      Target: mount.Destination,
      ReadOnly: mount.RW === false,
    }));
  const networkNames = Object.keys(inspect.NetworkSettings?.Networks || {});
  return {
    Image: inspect.Config?.Image,
    Env: inspect.Config?.Env || [],
    Labels: inspect.Config?.Labels || {},
    ExposedPorts: inspect.Config?.ExposedPorts || { "27015/udp": {}, "27015/tcp": {} },
    Healthcheck: inspect.Config?.Healthcheck,
    HostConfig: {
      PortBindings: inspect.HostConfig?.PortBindings || {},
      RestartPolicy: { Name: "unless-stopped", MaximumRetryCount: 0 },
      StopTimeout: inspect.Config?.StopTimeout ?? inspect.HostConfig?.StopTimeout ?? 30,
      Mounts: mounts,
      NanoCpus: inspect.HostConfig?.NanoCpus || 0,
      Memory: inspect.HostConfig?.Memory || 0,
    },
    NetworkingConfig: {
      EndpointsConfig: Object.fromEntries(networkNames.map((name) => [name, {}])),
    },
  };
}

function parsePayload(definition, image, defaultNetwork, allowedNetworks) {
  const payload = JSON.parse(definition.create_payload);
  if (!payload || typeof payload !== "object" || !Array.isArray(payload.Env))
    throw new Error("Invalid server definition");
  payload.Image = image || payload.Image;
  payload.Labels = {
    ...(payload.Labels || {}),
    "com.cs16.controlled": "true",
    "com.cs16.managed-by": panelManagedLabel,
    "com.cs16.instance-id": definition.server_id,
  };
  payload.HostConfig ??= {};
  payload.HostConfig.RestartPolicy = { Name: "unless-stopped", MaximumRetryCount: 0 };
  const requestedNetworks = Object.keys(payload.NetworkingConfig?.EndpointsConfig || {});
  const networks = requestedNetworks.filter((network) => allowedNetworks.includes(network));
  const selected = networks.length ? networks : [defaultNetwork];
  payload.NetworkingConfig = { EndpointsConfig: Object.fromEntries(selected.map((network) => [network, {}])) };
  return payload;
}

export async function saveServerDefinition(
  inspect,
  desiredState = definitionDesiredState(inspect),
  database = new Db(),
) {
  if (!database.enabled || inspect.Config?.Labels?.["com.cs16.managed-by"] !== panelManagedLabel) return null;
  const serverId = definitionServerId(inspect);
  const record = {
    server_id: serverId,
    container_name: String(inspect.Name || `cs16-instance-${serverId}`).replace(/^\//, ""),
    create_payload: JSON.stringify(definitionCreatePayload(inspect)),
    desired_state: ["running", "paused"].includes(desiredState) ? desiredState : "stopped",
    enabled: true,
    container_id: inspect.Id,
    last_reconciled_at: new Date(),
    last_error: null,
    updated_at: new Date(),
  };
  await (await database.db())("panel_server_definitions").insert(record).onConflict("server_id").merge(record);
  return record;
}

export async function deleteServerDefinition(serverId, database = new Db()) {
  if (!database.enabled) return;
  await (await database.db())("panel_server_definitions").where({ server_id: serverId }).delete();
}

export async function reconcileServerDefinitions({
  database = new Db(),
  docker = new DockerClient(),
  image = process.env.SERVER_IMAGE || "cs16-server:local",
  defaultNetwork = process.env.PANEL_NETWORK || "cs16_default",
  allowedNetworks = (process.env.PANEL_ALLOWED_NETWORKS || process.env.PANEL_NETWORK || "cs16_default")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
} = {}) {
  if (!database.enabled) return { restored: [], existing: [], failed: [] };
  const db = await database.db();
  const filters = encodeURIComponent(JSON.stringify({ label: [controlledLabel] }));
  const containers = await docker.request("GET", `/containers/json?all=1&filters=${filters}`);
  const inspections = await Promise.all(
    containers.map((container) => docker.request("GET", `/containers/${container.Id}/json`)),
  );
  const panelServers = inspections.filter(
    (inspect) => inspect.Config?.Labels?.["com.cs16.managed-by"] === panelManagedLabel,
  );
  const knownDefinitions = await db("panel_server_definitions").select("server_id", "desired_state");
  const knownStates = new Map(knownDefinitions.map((entry) => [entry.server_id, entry.desired_state]));
  for (const inspect of panelServers) {
    const serverId = definitionServerId(inspect);
    await saveServerDefinition(inspect, knownStates.get(serverId) || definitionDesiredState(inspect), database);
  }

  const existingByServerId = new Map(panelServers.map((inspect) => [definitionServerId(inspect), inspect]));
  const definitions = await db("panel_server_definitions").where({ enabled: true });
  const result = { restored: [], existing: [], failed: [] };
  for (const definition of definitions) {
    try {
      const existing = existingByServerId.get(definition.server_id);
      if (existing) {
        if (definition.desired_state === "stopped" && existing.State?.Running) {
          await requestStateChange(docker, `/containers/${existing.Id}/stop?t=30`);
        } else if (["running", "paused"].includes(definition.desired_state) && !existing.State?.Running) {
          await requestStateChange(docker, `/containers/${existing.Id}/start`);
        }
        if (definition.desired_state === "running" && existing.State?.Paused)
          await requestStateChange(docker, `/containers/${existing.Id}/unpause`);
        if (definition.desired_state === "paused" && !existing.State?.Paused)
          await requestStateChange(docker, `/containers/${existing.Id}/pause`);
        await db("panel_server_definitions").where({ server_id: definition.server_id }).update({
          container_id: existing.Id,
          last_reconciled_at: new Date(),
          last_error: null,
          updated_at: new Date(),
        });
        result.existing.push(definition.server_id);
        continue;
      }

      const payload = parsePayload(definition, image, defaultNetwork, allowedNetworks);
      for (const mount of payload.HostConfig?.Mounts || []) {
        if (mount.Type === "volume") {
          await docker.request("POST", "/volumes/create", {
            Name: mount.Source,
            Labels: { "com.cs16.controlled": "true", "com.cs16.instance-id": definition.server_id },
          });
        }
      }
      const created = await docker.request(
        "POST",
        `/containers/create?name=${encodeURIComponent(definition.container_name)}`,
        payload,
      );
      if (["running", "paused"].includes(definition.desired_state))
        await requestStateChange(docker, `/containers/${created.Id}/start`);
      if (definition.desired_state === "paused") await requestStateChange(docker, `/containers/${created.Id}/pause`);
      await db("panel_server_definitions").where({ server_id: definition.server_id }).update({
        container_id: created.Id,
        last_reconciled_at: new Date(),
        last_error: null,
        updated_at: new Date(),
      });
      result.restored.push(definition.server_id);
    } catch (error) {
      const message = String(error.message || error).slice(0, 4000);
      await db("panel_server_definitions").where({ server_id: definition.server_id }).update({
        last_reconciled_at: new Date(),
        last_error: message,
        updated_at: new Date(),
      });
      result.failed.push({ serverId: definition.server_id, error: message });
    }
  }
  return result;
}
