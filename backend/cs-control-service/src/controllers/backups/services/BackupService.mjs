import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { gzip, gunzip } from "node:zlib";
import { DockerClient, demuxDockerStream } from "../../../infrastructure/Docker.mjs";
import { createTar, parseTar } from "../../../infrastructure/Tar.mjs";
import { controlledServerInspect, restoreServerConfiguration } from "../../servers/services/ServersService.mjs";

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);
const docker = new DockerClient();
const backupDirectory = process.env.BACKUP_DIR || "/backups";
const serverImage = process.env.SERVER_IMAGE || "cs16-server:local";
const panelNetwork = process.env.PANEL_NETWORK || "cs16_default";
const databaseImage = process.env.DB_BACKUP_IMAGE || "mariadb:11.8";
const dataTarget = "/opt/hlds/cstrike/addons/amxmodx/data";
const logsTarget = "/opt/hlds/cstrike/logs";
const managedLabel = "com.cs16.controlled=true";
const databaseConfig = {
  enabled: process.env.DB_ENABLED === "1",
  host: process.env.DB_HOST || "mariadb",
  name: process.env.DB_NAME || "cs16",
  user: process.env.DB_USER || "cs16",
  password: process.env.DB_PASSWORD || "",
};

function envValue(inspect, name, fallback = "") {
  const prefix = `${name}=`;
  const entry = (inspect.Config?.Env || []).find((value) => value.startsWith(prefix));
  return entry ? entry.slice(prefix.length) : fallback;
}

function serverKey(inspect) {
  return envValue(inspect, "SERVER_ID") || inspect.Config?.Labels?.["com.cs16.instance-id"] || inspect.Id.slice(0, 12);
}

function safeBackupName(value) {
  const name = path.basename(String(value || ""));
  if (!/^[a-zA-Z0-9_.-]+\.cs16-backup\.tar\.gz$/.test(name)) throw new Error("Invalid backup filename");
  return name;
}

function checksum(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

async function ensureBackupDirectory() {
  await fs.mkdir(backupDirectory, { recursive: true });
}

async function waitContainer(id) {
  await docker.request("POST", `/containers/${id}/start`);
  const result = await docker.request("POST", `/containers/${id}/wait?condition=not-running`);
  const logs = await docker.request("GET", `/containers/${id}/logs?stdout=1&stderr=1`);
  const output = demuxDockerStream(logs);
  if (result.StatusCode !== 0) throw new Error(output.trim() || `Backup helper failed (${result.StatusCode})`);
  return output;
}

async function databaseDump() {
  if (!databaseConfig.enabled) throw new Error("MariaDB backup is unavailable because database support is disabled");
  let helper = null;
  try {
    helper = await docker.request("POST", `/containers/create?name=cs16-db-backup-${crypto.randomUUID().slice(0, 8)}`, {
      Image: databaseImage,
      Env: [`MYSQL_PWD=${databaseConfig.password}`],
      Entrypoint: ["mariadb-dump"],
      Cmd: [
        `--host=${databaseConfig.host}`,
        `--user=${databaseConfig.user}`,
        "--skip-ssl",
        "--single-transaction",
        "--routines",
        "--events",
        "--triggers",
        "--add-drop-table",
        "--default-character-set=utf8mb4",
        databaseConfig.name,
      ],
      Labels: { "com.cs16.temporary": "true" },
      NetworkingConfig: { EndpointsConfig: { [panelNetwork]: {} } },
    });
    return Buffer.from(await waitContainer(helper.Id));
  } finally {
    if (helper?.Id) await docker.request("DELETE", `/containers/${helper.Id}?force=1&v=0`).catch(() => {});
  }
}

async function restoreDatabase(sql) {
  if (!databaseConfig.enabled) throw new Error("MariaDB restore is unavailable because database support is disabled");
  let helper = null;
  try {
    helper = await docker.request(
      "POST",
      `/containers/create?name=cs16-db-restore-${crypto.randomUUID().slice(0, 8)}`,
      {
        Image: databaseImage,
        Env: [`MYSQL_PWD=${databaseConfig.password}`],
        Entrypoint: ["sh", "-c"],
        Cmd: [
          'exec mariadb --skip-ssl --host="$1" --user="$2" --default-character-set=utf8mb4 "$3" < /restore/database.sql',
          "db-restore",
          databaseConfig.host,
          databaseConfig.user,
          databaseConfig.name,
        ],
        Labels: { "com.cs16.temporary": "true" },
        NetworkingConfig: { EndpointsConfig: { [panelNetwork]: {} } },
      },
    );
    const archive = createTar([{ path: "restore/database.sql", content: sql }]);
    await docker.request("PUT", `/containers/${helper.Id}/archive?path=/`, archive, "application/x-tar");
    await waitContainer(helper.Id);
  } finally {
    if (helper?.Id) await docker.request("DELETE", `/containers/${helper.Id}?force=1&v=0`).catch(() => {});
  }
}

async function clearVolume(volumeName) {
  let helper = null;
  try {
    helper = await docker.request(
      "POST",
      `/containers/create?name=cs16-volume-clear-${crypto.randomUUID().slice(0, 8)}`,
      {
        Image: serverImage,
        User: "root",
        Entrypoint: ["sh", "-c"],
        Cmd: ["find /target -mindepth 1 -delete"],
        Labels: { "com.cs16.temporary": "true" },
        HostConfig: { Mounts: [{ Type: "volume", Source: volumeName, Target: "/target" }] },
      },
    );
    await waitContainer(helper.Id);
  } finally {
    if (helper?.Id) await docker.request("DELETE", `/containers/${helper.Id}?force=1&v=0`).catch(() => {});
  }
}

function volumeName(inspect, target) {
  const mount = (inspect.Mounts || []).find((entry) => entry.Type === "volume" && entry.Destination === target);
  if (!mount?.Name) throw new Error(`Persistent volume is missing for ${target}`);
  return mount.Name;
}

async function archivePath(containerId, target) {
  return docker.request("GET", `/containers/${containerId}/archive?path=${encodeURIComponent(target)}`);
}

function validateNestedArchive(archive, root) {
  const files = parseTar(archive, { maxFiles: 20_000, maxBytes: 512 * 1024 * 1024 });
  for (const name of files.keys()) {
    if (name !== root && !name.startsWith(`${root}/`)) throw new Error(`Backup contains an invalid ${root} path`);
  }
}

export async function createServerBackup(id, options = {}) {
  const inspect = await controlledServerInspect(id);
  if (inspect.Config?.Labels?.["com.cs16.managed-by"] !== "panel") {
    throw new Error("Only panel-managed servers support managed backup and restore");
  }
  await ensureBackupDirectory();
  const includeLogs = options.includeLogs === true;
  const includeDatabase = options.includeDatabase === true;
  const kind = options.kind === "safety" ? "safety" : "manual";
  const dataArchive = await archivePath(inspect.Id, dataTarget);
  const logsArchive = includeLogs ? await archivePath(inspect.Id, logsTarget) : null;
  const sql = includeDatabase ? await databaseDump() : null;
  const createdAt = new Date().toISOString();
  const key = serverKey(inspect);
  const filename = `${key}-${createdAt.replace(/[:.]/g, "-")}-${crypto.randomUUID().slice(0, 6)}.cs16-backup.tar.gz`;
  const manifest = {
    format: "cs16-server-backup",
    version: 1,
    createdAt,
    kind,
    serverId: key,
    name: inspect.Config?.Labels?.["com.cs16.display-name"] || envValue(inspect, "SERVER_NAME"),
    containerName: inspect.Name.replace(/^\//, ""),
    mode: envValue(inspect, "SERVER_MODE", "classic"),
    image: inspect.Config?.Image,
    imageId: inspect.Image,
    environment: inspect.Config?.Env || [],
    includes: { data: true, logs: includeLogs, database: includeDatabase },
    checksums: {
      data: checksum(dataArchive),
      logs: logsArchive ? checksum(logsArchive) : null,
      database: sql ? checksum(sql) : null,
    },
    containsSecrets: true,
  };
  const archive = createTar([
    { path: "manifest.json", content: Buffer.from(JSON.stringify(manifest, null, 2)) },
    { path: "amxx-data.tar", content: dataArchive },
    ...(logsArchive ? [{ path: "logs.tar", content: logsArchive }] : []),
    ...(sql ? [{ path: "database.sql", content: sql }] : []),
  ]);
  const compressed = await gzipAsync(archive, { level: 6 });
  const destination = path.join(backupDirectory, filename);
  const temporary = `${destination}.tmp`;
  await fs.writeFile(temporary, compressed, { mode: 0o600 });
  await fs.rename(temporary, destination);
  const metadata = { filename, ...manifest, size: compressed.length };
  delete metadata.environment;
  delete metadata.checksums;
  await fs.writeFile(`${destination}.json`, JSON.stringify(metadata, null, 2), { mode: 0o600 });
  return metadata;
}

export async function listBackups(serverId = null) {
  await ensureBackupDirectory();
  const entries = await fs.readdir(backupDirectory);
  const backups = [];
  for (const entry of entries.filter((name) => name.endsWith(".cs16-backup.tar.gz.json"))) {
    try {
      const metadata = JSON.parse(await fs.readFile(path.join(backupDirectory, entry), "utf8"));
      if (!serverId || metadata.serverId === serverId) backups.push(metadata);
    } catch {}
  }
  return backups.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function backupFile(filename) {
  const safe = safeBackupName(filename);
  const file = path.join(backupDirectory, safe);
  const stat = await fs.stat(file);
  if (!stat.isFile()) throw new Error("Backup file was not found");
  return { file, filename: safe };
}

export async function deleteBackup(filename) {
  const { file } = await backupFile(filename);
  await fs.unlink(file);
  await fs.unlink(`${file}.json`).catch(() => {});
  return { status: "deleted", filename: path.basename(file) };
}

async function readBackup(filename) {
  const { file } = await backupFile(filename);
  const compressed = await fs.readFile(file);
  if (compressed.length > 512 * 1024 * 1024) throw new Error("Backup file exceeds the restore limit");
  const archive = await gunzipAsync(compressed);
  const entries = parseTar(archive, { maxFiles: 8, maxBytes: 768 * 1024 * 1024 });
  const manifestFile = entries.get("manifest.json");
  const dataArchive = entries.get("amxx-data.tar");
  if (!manifestFile || !dataArchive) throw new Error("Backup is missing its manifest or AMXX data");
  const manifest = JSON.parse(manifestFile.toString("utf8"));
  if (manifest.format !== "cs16-server-backup" || manifest.version !== 1) throw new Error("Unsupported backup format");
  for (const [key, entryName] of [
    ["data", "amxx-data.tar"],
    ["logs", "logs.tar"],
    ["database", "database.sql"],
  ]) {
    const entry = entries.get(entryName);
    if ((manifest.checksums?.[key] || null) !== (entry ? checksum(entry) : null)) {
      throw new Error(`Backup checksum failed for ${entryName}`);
    }
  }
  validateNestedArchive(dataArchive, "data");
  if (entries.has("logs.tar")) validateNestedArchive(entries.get("logs.tar"), "logs");
  return { manifest, entries };
}

async function controlledContainers() {
  const filters = encodeURIComponent(JSON.stringify({ label: [managedLabel] }));
  return docker.request("GET", `/containers/json?all=1&filters=${filters}`);
}

export async function restoreServerBackup(id, filename, options = {}) {
  let inspect = await controlledServerInspect(id);
  if (inspect.Config?.Labels?.["com.cs16.managed-by"] !== "panel") {
    throw new Error("Only panel-managed servers can be restored");
  }
  const { manifest, entries } = await readBackup(filename);
  if (manifest.serverId !== serverKey(inspect)) throw new Error("Backup belongs to a different SERVER_ID");
  const restoreLogs = options.restoreLogs !== false && entries.has("logs.tar");
  const restoreDb = options.restoreDatabase === true;
  if (restoreDb && !entries.has("database.sql")) throw new Error("This backup does not include MariaDB data");
  const safety = await createServerBackup(id, { includeLogs: true, includeDatabase: false, kind: "safety" });

  const fleet = restoreDb ? await controlledContainers() : [{ Id: inspect.Id }];
  const running = [];
  let restoredContainerId = null;
  for (const container of fleet) {
    const state = await docker.request("GET", `/containers/${container.Id}/json`);
    if (state.State?.Running) {
      running.push(container.Id);
      await docker.request("POST", `/containers/${container.Id}/stop?t=30`);
    }
  }

  try {
    inspect = await controlledServerInspect(id);
    await clearVolume(volumeName(inspect, dataTarget));
    await docker.request(
      "PUT",
      `/containers/${inspect.Id}/archive?path=${encodeURIComponent(path.dirname(dataTarget))}`,
      entries.get("amxx-data.tar"),
      "application/x-tar",
    );
    if (restoreLogs) {
      await clearVolume(volumeName(inspect, logsTarget));
      await docker.request(
        "PUT",
        `/containers/${inspect.Id}/archive?path=${encodeURIComponent(path.dirname(logsTarget))}`,
        entries.get("logs.tar"),
        "application/x-tar",
      );
    }
    const restored = await restoreServerConfiguration(inspect.Id, manifest.environment, false);
    restoredContainerId = restored.id;
    if (restoreDb) await restoreDatabase(entries.get("database.sql"));

    for (const previousId of running) {
      const startId = previousId === id ? restored.id : previousId;
      await docker.request("POST", `/containers/${startId}/start`).catch(() => {});
    }
    return {
      status: "restored",
      id: restored.id,
      filename: safeBackupName(filename),
      safetyBackup: safety.filename,
      logsRestored: restoreLogs,
      databaseRestored: restoreDb,
    };
  } catch (error) {
    for (const containerId of running) {
      const startId = containerId === id && restoredContainerId ? restoredContainerId : containerId;
      await docker.request("POST", `/containers/${startId}/start`).catch(() => {});
    }
    throw new Error(`${error.message}. Safety backup: ${safety.filename}`);
  }
}
