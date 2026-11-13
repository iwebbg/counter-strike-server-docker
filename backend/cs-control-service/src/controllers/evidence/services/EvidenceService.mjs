import crypto from "node:crypto";
import { DockerClient, demuxDockerStream } from "../../../infrastructure/Docker.mjs";
import { parseTar } from "../../../infrastructure/Tar.mjs";
import Db from "../../../utils/Db.mjs";
import { conflict, notFound } from "../../../utils/HttpError.mjs";
import { controlledServerInspect } from "../../servers/services/ServersService.mjs";

const docker = new DockerClient();
const logsTarget = "/opt/hlds/cstrike/logs";
const evidenceTarget = `${logsTarget}/evidence`;
const evidenceLabel = "com.cs16.evidence=true";

function boundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(String(value ?? fallback), 10);
  return Number.isInteger(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
}

export function evidenceRetentionSettings(environment = process.env) {
  return {
    evidenceDays: boundedInteger(environment.EVIDENCE_RETENTION_DAYS, 30, 1, 3650),
    evidenceCount: boundedInteger(environment.EVIDENCE_RETENTION_COUNT, 50, 1, 10000),
    logDays: boundedInteger(environment.SERVER_LOG_RETENTION_DAYS, 30, 1, 3650),
  };
}

export function safeEvidenceFilename(value) {
  const filename = String(value || "");
  return /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,120}\.dem$/.test(filename) ? filename : null;
}

export function evidenceContainerName(serverId) {
  const suffix = crypto.createHash("sha256").update(String(serverId)).digest("hex").slice(0, 12);
  return `cs16-hltv-${suffix}`;
}

function serverKey(inspect) {
  return inspect.Config?.Env?.find((entry) => entry.startsWith("SERVER_ID="))?.slice(10) || inspect.Id.slice(0, 12);
}

function storageMount(inspect) {
  const mount = (inspect.Mounts || []).find((entry) => entry.Destination === logsTarget);
  if (!mount?.Source || !["volume", "bind"].includes(mount.Type)) throw conflict("EVIDENCE_STORAGE_NOT_AVAILABLE");
  return {
    Type: mount.Type,
    Source: mount.Type === "volume" ? mount.Name || mount.Source : mount.Source,
    Target: logsTarget,
    ReadOnly: false,
  };
}

async function evidenceContainers(inspect) {
  const key = serverKey(inspect);
  const filters = encodeURIComponent(JSON.stringify({ label: [evidenceLabel, `com.cs16.evidence-server=${key}`] }));
  return docker.request("GET", `/containers/json?all=1&filters=${filters}`);
}

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function waitForHltv(containerId, timeoutMs = Number(process.env.EVIDENCE_READY_TIMEOUT_MS || 20000)) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const inspect = await docker.request("GET", `/containers/${containerId}/json`);
    if (!inspect.State?.Running) throw new Error("HLTV evidence sidecar stopped before becoming ready");
    const output = await docker.request("GET", `/containers/${containerId}/logs?stdout=1&stderr=1&tail=100`);
    const logs = demuxDockerStream(output);
    if (logs.includes("Received baseline") || logs.includes("Director module initialized")) return;
    await delay(250);
  }
  throw new Error("HLTV evidence sidecar did not connect before the readiness timeout");
}

async function waitForRecording(containerId, timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const output = await docker.request("GET", `/containers/${containerId}/logs?stdout=1&stderr=1&tail=30`);
    if (demuxDockerStream(output).includes("Recording initialized")) return;
    await delay(100);
  }
  throw new Error("HLTV rejected the evidence recording command");
}

async function sidecarCommand(containerId, command) {
  const created = await docker.request("POST", `/containers/${containerId}/exec`, {
    AttachStdout: true,
    AttachStderr: true,
    Tty: false,
    User: "hlds",
    Cmd: command,
  });
  const output = await docker.request("POST", `/exec/${created.Id}/start`, { Detach: false, Tty: false });
  const result = await docker.request("GET", `/exec/${created.Id}/json`);
  const text = demuxDockerStream(output).trim();
  if (result.ExitCode !== 0) throw new Error(text || "HLTV evidence file could not be persisted");
  return text;
}

async function withStorageHelper(inspect, callback) {
  let helper;
  try {
    try {
      helper = await docker.request("POST", `/containers/create?name=cs16-evidence-helper-${crypto.randomUUID()}`, {
        Image: inspect.Config.Image,
        Entrypoint: ["sh"],
        Cmd: ["-c", "true"],
        Labels: { "com.cs16.temporary": "true" },
        HostConfig: { Mounts: [storageMount(inspect)] },
      });
    } catch (error) {
      throw new Error(`${error.message}${error.details ? `: ${error.details}` : ""}`);
    }
    return await callback(helper.Id);
  } finally {
    if (helper?.Id) await docker.request("DELETE", `/containers/${helper.Id}?force=1&v=0`).catch(() => {});
  }
}

async function runStorageCommand(inspect, script) {
  return withStorageHelper(inspect, async (helperId) => {
    const helperInspect = await docker.request("GET", `/containers/${helperId}/json`);
    const payload = { ...helperInspect.Config, Entrypoint: ["sh"], Cmd: ["-c", script] };
    await docker.request("DELETE", `/containers/${helperId}?v=0`);
    const replacement = await docker.request(
      "POST",
      `/containers/create?name=cs16-evidence-helper-${crypto.randomUUID()}`,
      {
        ...payload,
        Labels: { "com.cs16.temporary": "true" },
        HostConfig: { Mounts: [storageMount(inspect)] },
      },
    );
    helperId = replacement.Id;
    await docker.request("POST", `/containers/${helperId}/start`);
    const result = await docker.request("POST", `/containers/${helperId}/wait?condition=not-running`);
    const output = await docker.request("GET", `/containers/${helperId}/logs?stdout=1&stderr=1`);
    await docker.request("DELETE", `/containers/${helperId}?v=0`);
    if (result.StatusCode !== 0) throw new Error(demuxDockerStream(output).trim() || "Evidence storage command failed");
    return demuxDockerStream(output);
  });
}

export async function evidenceStatus(id) {
  const inspect = await controlledServerInspect(id);
  const containers = await evidenceContainers(inspect);
  const active = containers.find((entry) => entry.State === "running");
  const output = await runStorageCommand(
    inspect,
    `mkdir -p '${evidenceTarget}'; find '${evidenceTarget}' -maxdepth 1 -type f -name '*.dem' -printf '%f|%s|%T@\\n' | sort -t'|' -k3nr`,
  );
  const recordings = output
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [filename, size, modified] = line.split("|");
      return { filename, size: Number(size), modifiedAt: new Date(Number(modified) * 1000).toISOString() };
    })
    .filter((entry) => safeEvidenceFilename(entry.filename));
  return {
    recording: Boolean(active),
    filename: active?.Labels?.["com.cs16.evidence-file"] || null,
    startedAt: active?.Labels?.["com.cs16.evidence-started-at"] || null,
    recordings,
  };
}

export async function runEvidenceRetention(id, settings = evidenceRetentionSettings()) {
  const inspect = await controlledServerInspect(id);
  let protectedFiles = [];
  if (Db.enabled) {
    protectedFiles = await (
      await new Db().db()
    )("panel_evidence_markers")
      .where({ server_id: serverKey(inspect) })
      .distinct("recording_filename")
      .then((rows) => rows.map((row) => safeEvidenceFilename(row.recording_filename)).filter(Boolean));
  }
  const protectedExpression = protectedFiles.map((filename) => `! -name '${filename}'`).join(" ");
  const removableEvidence = `find '${evidenceTarget}' -maxdepth 1 -type f -name '*.dem' ${protectedExpression}`;
  const keepFrom = settings.evidenceCount + 1;
  const output = await runStorageCommand(
    inspect,
    [
      `mkdir -p '${evidenceTarget}'`,
      `before_evidence=$(find '${evidenceTarget}' -maxdepth 1 -type f -name '*.dem' | wc -l)`,
      `${removableEvidence} -mtime +${settings.evidenceDays} -delete`,
      `${removableEvidence} -printf '%T@ %p\\0' | sort -zrn | tail -z -n +${keepFrom} | cut -z -d' ' -f2- | xargs -0 -r rm -f --`,
      `after_evidence=$(find '${evidenceTarget}' -maxdepth 1 -type f -name '*.dem' | wc -l)`,
      `before_logs=$(find '${logsTarget}' -maxdepth 1 -type f -name '*.log' | wc -l)`,
      `find '${logsTarget}' -maxdepth 1 -type f -name '*.log' -mtime +${settings.logDays} -delete`,
      `after_logs=$(find '${logsTarget}' -maxdepth 1 -type f -name '*.log' | wc -l)`,
      `printf '%s|%s|%s|%s\\n' "$before_evidence" "$after_evidence" "$before_logs" "$after_logs"`,
    ].join("; "),
  );
  const values = output.trim().split("|").map(Number);
  return {
    evidenceDeleted: Math.max(0, values[0] - values[1]),
    evidenceRemaining: values[1] || 0,
    logsDeleted: Math.max(0, values[2] - values[3]),
    logsRemaining: values[3] || 0,
  };
}

export async function startEvidence(id) {
  const inspect = await controlledServerInspect(id);
  if (!inspect.State?.Running) throw conflict("SERVER_NOT_RUNNING");
  const existing = await evidenceContainers(inspect);
  if (existing.some((entry) => entry.State === "running")) throw conflict("EVIDENCE_ALREADY_RECORDING");
  await Promise.all(existing.map((entry) => docker.request("DELETE", `/containers/${entry.Id}?force=1&v=0`)));
  await runStorageCommand(inspect, `mkdir -p '${evidenceTarget}'`);
  const key = serverKey(inspect);
  const base = `evidence-${new Date().toISOString().replace(/[:.]/g, "-")}-${crypto.randomUUID().slice(0, 8)}`;
  const network = Object.keys(inspect.NetworkSettings?.Networks || {})[0];
  if (!network) throw conflict("SERVER_NETWORK_NOT_AVAILABLE");
  const target = String(inspect.Name || "").replace(/^\//, "");
  const sidecar = await docker.request(
    "POST",
    `/containers/create?name=${encodeURIComponent(evidenceContainerName(key))}`,
    {
      Image: inspect.Config.Image,
      Entrypoint: ["/opt/hlds/hltv"],
      Cmd: ["-nomaster", "-port", "27020", "+connect", `${target}:27015`],
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      OpenStdin: true,
      StdinOnce: false,
      Tty: true,
      Env: ["LD_LIBRARY_PATH=/opt/hlds"],
      User: "hlds",
      WorkingDir: "/opt/hlds",
      Labels: {
        "com.cs16.evidence": "true",
        "com.cs16.evidence-server": key,
        "com.cs16.evidence-file": base,
        "com.cs16.evidence-started-at": new Date().toISOString(),
      },
      HostConfig: { Mounts: [storageMount(inspect)], RestartPolicy: { Name: "no" } },
      NetworkingConfig: { EndpointsConfig: { [network]: {} } },
    },
  );
  try {
    await docker.request("POST", `/containers/${sidecar.Id}/start`);
    await waitForHltv(sidecar.Id);
    await docker.writeStdin(sidecar.Id, `record ${base}\r\n`);
    await waitForRecording(sidecar.Id);
  } catch (error) {
    await docker.request("DELETE", `/containers/${sidecar.Id}?force=1&v=0`).catch(() => {});
    throw error;
  }
  return { recording: true, filename: base, containerId: sidecar.Id };
}

export async function stopEvidence(id) {
  const inspect = await controlledServerInspect(id);
  const containers = await evidenceContainers(inspect);
  const active = containers.find((entry) => entry.State === "running");
  if (!active) throw notFound("EVIDENCE_NOT_RECORDING");
  const recordingName = active.Labels?.["com.cs16.evidence-file"] || "";
  await docker.writeStdin(active.Id, "stoprecording\r\n").catch(() => {});
  await delay(1000);
  const filename = await sidecarCommand(active.Id, [
    "sh",
    "-c",
    `file=""; i=0; while test "$i" -lt 20; do file=$(find /opt/hlds -maxdepth 1 -type f -name "$1-*.dem" | head -n 1); test -n "$file" && break; i=$((i + 1)); sleep 0.25; done; if test -n "$file"; then cp "$file" '${evidenceTarget}/' && basename "$file"; fi`,
    "persist-evidence",
    recordingName,
  ]);
  await docker.request("POST", `/containers/${active.Id}/stop?t=3`);
  await docker.request("DELETE", `/containers/${active.Id}?v=0`);
  if (filename && Db.enabled) {
    await (
      await new Db().db()
    )("panel_evidence_markers")
      .where({ server_id: serverKey(inspect), recording_filename: `${recordingName}.dem` })
      .update({ recording_filename: filename });
  }
  return { recording: false, filename: filename || null };
}

export async function evidenceFile(id, requestedFilename) {
  const filename = safeEvidenceFilename(requestedFilename);
  if (!filename) throw notFound("EVIDENCE_NOT_FOUND");
  const inspect = await controlledServerInspect(id);
  return withStorageHelper(inspect, async (helperId) => {
    const path = `${evidenceTarget}/${filename}`;
    const archive = await docker.request("GET", `/containers/${helperId}/archive?path=${encodeURIComponent(path)}`);
    const files = parseTar(archive, { maxFiles: 2, maxBytes: Number(process.env.EVIDENCE_MAX_BYTES || 536870912) });
    const content = files.get(filename) || files.get(`evidence/${filename}`);
    if (!content) throw notFound("EVIDENCE_NOT_FOUND");
    return { filename, content };
  });
}
