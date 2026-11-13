import { DockerClient } from "../../../infrastructure/Docker.mjs";
import Db from "../../../utils/Db.mjs";
import { conflict, notFound } from "../../../utils/HttpError.mjs";
import { modeMaps } from "../../servers/services/schemas.mjs";
import { reconcileServerDefinitions } from "../../servers/services/ServerDefinitionService.mjs";
import { createServer } from "../../servers/services/ServersService.mjs";

const idPattern = /^[a-z0-9][a-z0-9-]{0,63}$/;
const volumePattern = /^cs16_([a-z0-9][a-z0-9-]{0,63})_(data|logs)$/;

function envValue(inspect, name) {
  const prefix = `${name}=`;
  return (inspect.Config?.Env || []).find((entry) => entry.startsWith(prefix))?.slice(prefix.length) || "";
}

function containerServerId(inspect) {
  return envValue(inspect, "SERVER_ID") || inspect.Config?.Labels?.["com.cs16.instance-id"] || "";
}

function normalizeVolume(volume) {
  const match = volumePattern.exec(volume.Name || "");
  if (!match) return null;
  return {
    serverId: match[1],
    kind: match[2],
    name: volume.Name,
    size: Math.max(0, Number(volume.UsageData?.Size || 0)),
    refCount: Number(volume.UsageData?.RefCount ?? -1),
  };
}

async function dockerInventory(docker) {
  const filters = encodeURIComponent(JSON.stringify({ label: ["com.cs16.controlled=true"] }));
  const containers = await docker.request("GET", `/containers/json?all=1&filters=${filters}`);
  const inspections = await Promise.all(
    containers.map((container) => docker.request("GET", `/containers/${container.Id}/json`)),
  );
  let volumes = [];
  try {
    const usage = await docker.request("GET", "/system/df?type=volume");
    volumes = usage.Volumes || [];
  } catch {
    const response = await docker.request("GET", "/volumes");
    volumes = response.Volumes || [];
  }
  return { inspections, volumes: volumes.map(normalizeVolume).filter(Boolean) };
}

export function buildManagedResourceInventory({ inspections = [], volumes = [], definitions = [], registry = [] }) {
  const byId = new Map();
  const entry = (serverId) => {
    if (!byId.has(serverId)) byId.set(serverId, { serverId, volumes: [] });
    return byId.get(serverId);
  };

  for (const inspect of inspections) {
    if (inspect.Config?.Labels?.["com.cs16.managed-by"] !== "panel") continue;
    const serverId = containerServerId(inspect);
    if (!idPattern.test(serverId)) continue;
    const item = entry(serverId);
    item.container = {
      id: inspect.Id,
      name: String(inspect.Name || "").replace(/^\//, ""),
      state: inspect.State?.Paused ? "paused" : inspect.State?.Running ? "running" : "stopped",
    };
    item.name = inspect.Config?.Labels?.["com.cs16.display-name"] || envValue(inspect, "SERVER_NAME");
    item.mode = envValue(inspect, "SERVER_MODE");
  }
  for (const definition of definitions) {
    const item = entry(definition.server_id);
    item.definition = {
      desiredState: definition.desired_state,
      enabled: Boolean(definition.enabled),
      lastReconciledAt: definition.last_reconciled_at,
      lastError: definition.last_error,
    };
  }
  for (const server of registry) {
    const item = entry(server.server_id);
    item.registry = {
      name: server.display_name,
      mode: server.mode,
      port: server.host_port,
      maxPlayers: server.max_players,
      currentMap: server.current_map,
      state: server.state,
      lastHeartbeat: server.last_heartbeat,
    };
    item.name ||= server.display_name;
    item.mode ||= server.mode;
  }
  for (const volume of volumes) entry(volume.serverId).volumes.push(volume);

  const resources = [...byId.values()].map((item) => {
    let classification = "stale-registry";
    if (item.container && item.definition) classification = "managed";
    else if (item.definition) classification = "recoverable";
    else if (item.volumes.length && item.registry) classification = "legacy";
    else if (item.volumes.length) classification = "orphaned";
    else if (item.container) classification = "untracked";
    const bytes = item.volumes.reduce((sum, volume) => sum + volume.size, 0);
    return { ...item, classification, bytes };
  });
  resources.sort((a, b) => a.serverId.localeCompare(b.serverId));
  return {
    resources,
    summary: {
      total: resources.length,
      recoverable: resources.filter((item) => item.classification === "recoverable").length,
      retained: resources.filter((item) => ["legacy", "orphaned"].includes(item.classification)).length,
      reclaimableBytes: resources
        .filter((item) => ["legacy", "orphaned"].includes(item.classification))
        .reduce((sum, item) => sum + item.bytes, 0),
    },
  };
}

export async function listManagedResources({ database = new Db(), docker = new DockerClient() } = {}) {
  const { inspections, volumes } = await dockerInventory(docker);
  const db = database.enabled ? await database.db() : null;
  const definitions = db ? await db("panel_server_definitions").select("*") : [];
  const registry = db ? await db("cs_servers").select("*") : [];
  return buildManagedResourceInventory({ inspections, volumes, definitions, registry });
}

async function resourceById(serverId, dependencies) {
  if (!idPattern.test(serverId)) throw notFound();
  const inventory = await listManagedResources(dependencies);
  const resource = inventory.resources.find((item) => item.serverId === serverId);
  if (!resource) throw notFound();
  return resource;
}

export async function reconcileManagedResource(serverId, dependencies = {}) {
  const resource = await resourceById(serverId, dependencies);
  if (!resource.definition) throw conflict("SERVER_DEFINITION_NOT_FOUND");
  const result = await reconcileServerDefinitions(dependencies);
  const failure = result.failed.find((entry) => entry.serverId === serverId);
  if (failure) throw conflict("SERVER_RECONCILIATION_FAILED");
  return { serverId, restored: result.restored.includes(serverId), status: "reconciled" };
}

export async function recoverManagedResource(serverId, input = {}, dependencies = {}) {
  const resource = await resourceById(serverId, dependencies);
  if (resource.container || resource.definition || resource.classification !== "legacy") {
    throw conflict("SERVER_RESOURCE_NOT_RECOVERABLE");
  }
  const mode = resource.registry.mode === "gungame" ? "gungame" : "classic";
  const startMap = modeMaps[mode].includes(resource.registry.currentMap)
    ? resource.registry.currentMap
    : modeMaps[mode][0];
  return createServer(
    {
      name: resource.registry.name || `Recovered ${serverId}`,
      mode,
      maxPlayers: Number(resource.registry.maxPlayers || 24),
      startMap,
      maps: modeMaps[mode],
      port: resource.registry.port || null,
      rconPassword: String(input.rconPassword || ""),
      serverPassword: "",
      adminSteamIds: "",
      startImmediately: input.startImmediately === true,
    },
    { instanceId: serverId },
  );
}

export async function cleanupManagedResource(serverId, input = {}, dependencies = {}) {
  const database = dependencies.database || new Db();
  const docker = dependencies.docker || new DockerClient();
  const resource = await resourceById(serverId, { database, docker });
  if (resource.container || resource.definition) throw conflict("SERVER_RESOURCE_STILL_MANAGED");
  const removedVolumes = [];
  if (input.removeVolumes === true) {
    for (const volume of resource.volumes) {
      await docker.request("DELETE", `/volumes/${encodeURIComponent(volume.name)}`);
      removedVolumes.push(volume.name);
    }
  }
  if (input.removeRegistry === true && database.enabled) {
    await (await database.db())("cs_servers").where({ server_id: serverId }).delete();
  }
  return { serverId, removedVolumes, registryRemoved: input.removeRegistry === true };
}
