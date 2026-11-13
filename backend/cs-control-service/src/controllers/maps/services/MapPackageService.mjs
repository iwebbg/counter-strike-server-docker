import crypto from "node:crypto";
import { queryA2S } from "../../../infrastructure/A2S.mjs";
import { DockerClient, demuxDockerStream } from "../../../infrastructure/Docker.mjs";
import { controlledServerInspect } from "../../servers/services/ServersService.mjs";
import { createTar } from "../../../infrastructure/Tar.mjs";
import { parseZip } from "../../../infrastructure/Zip.mjs";
import { modeMaps, validateMapFiles, validateMapUpload } from "../../servers/services/schemas.mjs";

const docker = new DockerClient();
const image = process.env.SERVER_IMAGE || "cs16-server:local";
const network = process.env.PANEL_NETWORK || "cs16_default";
const dataTarget = "/opt/hlds/cstrike/addons/amxmodx/data";
const resourceRoot = "/data/custom_maps/resources";
const packageRoot = "/data/custom_maps/packages";

function envValue(inspect, name, fallback = "") {
  const prefix = `${name}=`;
  const value = (inspect.Config?.Env || []).find((entry) => entry.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

function address(inspect) {
  const networks = inspect.NetworkSettings?.Networks || {};
  return networks[network]?.IPAddress || Object.values(networks).find((entry) => entry.IPAddress)?.IPAddress || "";
}

async function inspectServer(id) {
  const inspect = await controlledServerInspect(id);
  const mount = (inspect.Mounts || []).find((entry) => entry.Type === "volume" && entry.Destination === dataTarget);
  if (!mount?.Name) throw new Error("The server AMXX data volume could not be found");
  return { inspect, volume: mount.Name };
}

async function helper(volume, script, args = []) {
  let container = null;
  try {
    container = await docker.request(
      "POST",
      `/containers/create?name=cs16-map-package-${crypto.randomUUID().slice(0, 8)}`,
      {
        Image: image,
        User: "root",
        Entrypoint: ["sh", "-c"],
        Cmd: [script, "map-package", ...args],
        Labels: { "com.cs16.temporary": "true" },
        HostConfig: { Mounts: [{ Type: "volume", Source: volume, Target: "/data" }] },
      },
    );
    await docker.request("POST", `/containers/${container.Id}/start`);
    const result = await docker.request("POST", `/containers/${container.Id}/wait?condition=not-running`);
    const logs = demuxDockerStream(await docker.request("GET", `/containers/${container.Id}/logs?stdout=1&stderr=1`));
    if (result.StatusCode !== 0) throw new Error(logs.trim() || `Map package helper failed (${result.StatusCode})`);
    return logs;
  } finally {
    if (container?.Id) await docker.request("DELETE", `/containers/${container.Id}?force=1&v=0`).catch(() => {});
  }
}

async function execServer(id, command) {
  const created = await docker.request("POST", `/containers/${id}/exec`, {
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

async function manifests(volume) {
  const output = await helper(
    volume,
    `if [ -d '${packageRoot}' ]; then for file in '${packageRoot}'/*.json; do [ -f "$file" ] || continue; cat "$file"; printf '\\036'; done; fi`,
  );
  return output
    .split("\x1e")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => JSON.parse(entry))
    .sort((left, right) => String(right.updatedAt || right.createdAt).localeCompare(left.updatedAt || left.createdAt));
}

async function resourcePaths(volume) {
  const output = await helper(
    volume,
    `if [ -d '${resourceRoot}' ]; then find '${resourceRoot}' -type f -printf '%P\n' | sort; fi`,
  );
  return output
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

async function categoryMaps(volume, mode) {
  const output = await helper(
    volume,
    `if [ -f '/data/custom_maps/categories/${mode}.txt' ]; then cat '/data/custom_maps/categories/${mode}.txt'; fi`,
  );
  return output
    .split("\n")
    .map((entry) => entry.trim())
    .filter((entry) => /^[a-zA-Z0-9_]+$/.test(entry));
}

async function validateWithGameImage(files) {
  let container = null;
  try {
    container = await docker.request(
      "POST",
      `/containers/create?name=cs16-map-validate-${crypto.randomUUID().slice(0, 8)}`,
      {
        Image: image,
        User: "hlds",
        Entrypoint: ["/usr/local/bin/install-custom-map-resources"],
        Cmd: ["/upload/resources", "/opt/hlds/cstrike"],
        Labels: { "com.cs16.temporary": "true" },
      },
    );
    await docker.request(
      "PUT",
      `/containers/${container.Id}/archive?path=/`,
      createTar(files.map((file) => ({ path: `upload/resources/${file.path}`, content: file.content }))),
      "application/x-tar",
    );
    await docker.request("POST", `/containers/${container.Id}/start`);
    const result = await docker.request("POST", `/containers/${container.Id}/wait?condition=not-running`);
    const logs = demuxDockerStream(await docker.request("GET", `/containers/${container.Id}/logs?stdout=1&stderr=1`));
    if (result.StatusCode !== 0) throw new Error(logs.trim() || "Map package validation failed");
  } finally {
    if (container?.Id) await docker.request("DELETE", `/containers/${container.Id}?force=1&v=0`).catch(() => {});
  }
}

function detectedMode(maps) {
  return maps.every((map) => map.toLowerCase().startsWith("gg_")) ? "gungame" : "classic";
}

function packageName(value, fallback) {
  const normalized = String(value || fallback || "Map package")
    .replace(/\.zip$/i, "")
    .trim();
  if (normalized.length < 2 || normalized.length > 80 || /[\u0000-\u001f]/.test(normalized)) {
    throw new Error("Map package name must contain 2-80 printable characters");
  }
  return normalized;
}

function sha256(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

async function liveMap(inspect) {
  if (!inspect.State?.Running) return null;
  const host = address(inspect);
  return host ? (await queryA2S(host, 27015).catch(() => null))?.map || null : null;
}

async function removePaths(volume, paths) {
  if (!paths.length) return;
  await helper(volume, `for path do rm -f -- '${resourceRoot}'/"$path"; done`, paths);
}

async function removeLivePaths(inspect, paths) {
  if (!inspect.State?.Running || !paths.length) return;
  await execServer(inspect.Id, [
    "sh",
    "-c",
    `for path do rm -f -- /opt/hlds/cstrike/"$path"; done`,
    "map-remove",
    ...paths,
  ]);
}

async function installLive(inspect) {
  if (!inspect.State?.Running) return;
  await execServer(inspect.Id, [
    "/usr/local/bin/install-custom-map-resources",
    `${dataTarget}/custom_maps/resources`,
    "/opt/hlds/cstrike",
  ]);
}

function normalizedPackage(mode, files, metadata = {}) {
  const values = validateMapFiles(mode, files);
  return {
    values,
    name: packageName(metadata.name, metadata.filename || values.maps[0]),
  };
}

async function savePackage(id, input, metadata = {}) {
  const { inspect, volume } = await inspectServer(id);
  const serverMode = envValue(inspect, "SERVER_MODE", "classic");
  const initialMode = input.mode === "classic" || input.mode === "gungame" ? input.mode : serverMode;
  const normalized = normalizedPackage(initialMode, input.files, metadata);
  const inferred = detectedMode(normalized.values.maps);
  const requestedMode = input.mode === "auto" || !input.mode ? inferred : input.mode;
  if (requestedMode !== serverMode) {
    throw new Error(`This ZIP looks like ${inferred}, but this server accepts only ${serverMode} packages`);
  }
  const values = requestedMode === initialMode ? normalized.values : validateMapFiles(requestedMode, input.files);
  const packages = await manifests(volume);
  const replacing = metadata.replacePackageId ? packages.find((entry) => entry.id === metadata.replacePackageId) : null;
  if (metadata.replacePackageId && !replacing)
    throw new Error("The map package selected for replacement was not found");
  if (replacing && replacing.mode !== serverMode) throw new Error("A package cannot change its server mode");

  const targetImage = await docker.request("GET", `/images/${encodeURIComponent(image)}/json`);
  if (inspect.Image !== targetImage.Id) throw new Error("Update the server image before managing custom maps");
  const builtIn = new Set(
    Object.values(modeMaps)
      .flat()
      .map((map) => map.toLowerCase()),
  );
  const duplicateBuiltIn = values.maps.find((map) => builtIn.has(map.toLowerCase()));
  if (duplicateBuiltIn) throw new Error(`Map ${duplicateBuiltIn} is already included in the server image`);

  const oldPaths = new Set((replacing?.files || []).map((file) => file.path.toLowerCase()));
  const existing = new Set((await resourcePaths(volume)).map((entry) => entry.toLowerCase()));
  const conflict = values.files.find(
    (file) => existing.has(file.path.toLowerCase()) && !oldPaths.has(file.path.toLowerCase()),
  );
  if (conflict) throw new Error(`Custom resource already belongs to another package: ${conflict.path}`);
  if (replacing) {
    const current = await liveMap(inspect);
    if (current && replacing.maps.includes(current))
      throw new Error(`Cannot replace a package while ${current} is playing`);
  }

  await validateWithGameImage(values.files);
  const packageId = replacing?.id || crypto.randomUUID();
  const now = new Date().toISOString();
  const otherMaps = new Set(packages.filter((entry) => entry.id !== packageId).flatMap((entry) => entry.maps));
  const category = [...new Set([...(await categoryMaps(volume, serverMode)), ...values.maps])].filter(
    (map) => !replacing?.maps.includes(map) || values.maps.includes(map) || otherMaps.has(map),
  );
  const manifest = {
    id: packageId,
    name: packageName(metadata.name, metadata.filename || values.maps[0]),
    filename: metadata.filename || null,
    source: metadata.source || "zip",
    mode: serverMode,
    maps: values.maps,
    files: values.files.map((file) => ({ path: file.path, bytes: file.content.length, sha256: sha256(file.content) })),
    bytes: values.files.reduce((sum, file) => sum + file.content.length, 0),
    createdAt: replacing?.createdAt || now,
    updatedAt: now,
  };
  const archive = createTar([
    ...values.files.map((file) => ({ path: `custom_maps/resources/${file.path}`, content: file.content })),
    { path: `custom_maps/categories/${serverMode}.txt`, content: Buffer.from(`${category.join("\n")}\n`) },
    { path: `custom_maps/packages/${packageId}.json`, content: Buffer.from(JSON.stringify(manifest, null, 2)) },
  ]);
  await docker.request(
    "PUT",
    `/containers/${inspect.Id}/archive?path=${encodeURIComponent(dataTarget)}`,
    archive,
    "application/x-tar",
  );
  const newPaths = new Set(values.files.map((file) => file.path.toLowerCase()));
  const stalePaths = (replacing?.files || [])
    .map((file) => file.path)
    .filter((entry) => !newPaths.has(entry.toLowerCase()));
  await removePaths(volume, stalePaths);
  if (replacing)
    await removeLivePaths(
      inspect,
      replacing.files.map((file) => file.path),
    );
  await installLive(inspect);
  return {
    status: replacing ? "replaced" : "uploaded",
    package: manifest,
    availableNow: Boolean(inspect.State?.Running),
  };
}

export async function uploadZipPackage(id, input) {
  const encoded = String(input.content || "");
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) {
    throw new Error("ZIP content is not valid base64");
  }
  const archive = Buffer.from(encoded, "base64");
  const files = parseZip(archive);
  return savePackage(
    id,
    { mode: input.mode || "auto", files },
    {
      filename: input.filename,
      name: input.name,
      source: "zip",
      replacePackageId: input.replacePackageId,
    },
  );
}

export async function uploadExtractedPackage(id, input) {
  const values = validateMapUpload(input);
  return savePackage(id, { mode: values.mode, files: values.files }, { name: input.name, source: "folder" });
}

export async function listMapPackages(id) {
  const { inspect, volume } = await inspectServer(id);
  const packages = await manifests(volume);
  const tracked = new Set(packages.flatMap((entry) => entry.files.map((file) => file.path.toLowerCase())));
  const resources = await resourcePaths(volume);
  const current = await liveMap(inspect);
  const selectedOutput = await helper(
    volume,
    "if [ -f /data/panel_mapcycle.txt ]; then cat /data/panel_mapcycle.txt; fi",
  );
  const selected = (selectedOutput.trim() ? selectedOutput : envValue(inspect, "MAPCYCLE"))
    .replaceAll(",", "\n")
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return {
    mode: envValue(inspect, "SERVER_MODE", "classic"),
    packages,
    current,
    selected,
    unmanagedFiles: resources.filter((entry) => !tracked.has(entry.toLowerCase())).length,
  };
}

export async function deleteMapPackage(id, packageId) {
  const { inspect, volume } = await inspectServer(id);
  const packages = await manifests(volume);
  const target = packages.find((entry) => entry.id === packageId);
  if (!target) throw new Error("Map package was not found");
  const listing = await listMapPackages(id);
  const activeRotation = target.maps.filter((map) => listing.selected.includes(map));
  if (activeRotation.length)
    throw new Error(`Remove these maps from the active rotation first: ${activeRotation.join(", ")}`);
  if (listing.current && target.maps.includes(listing.current)) {
    throw new Error(`Cannot delete a package while ${listing.current} is playing`);
  }
  const remaining = packages.filter((entry) => entry.id !== packageId);
  const remainingPaths = new Set(remaining.flatMap((entry) => entry.files.map((file) => file.path.toLowerCase())));
  const removable = target.files.map((file) => file.path).filter((entry) => !remainingPaths.has(entry.toLowerCase()));
  const remainingMaps = new Set(remaining.filter((entry) => entry.mode === target.mode).flatMap((entry) => entry.maps));
  const category = (await categoryMaps(volume, target.mode)).filter(
    (map) => !target.maps.includes(map) || remainingMaps.has(map),
  );
  await removePaths(volume, removable);
  await helper(
    volume,
    `rm -f -- '${packageRoot}'/"$1".json; printf '%s' "$2" > '/data/custom_maps/categories/${target.mode}.txt'`,
    [packageId, `${category.join("\n")}${category.length ? "\n" : ""}`],
  );
  await removeLivePaths(inspect, removable);
  return { status: "deleted", package: target, resourcesRemoved: removable.length };
}
