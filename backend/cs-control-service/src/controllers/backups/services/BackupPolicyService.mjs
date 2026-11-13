import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import Db from "../../../utils/Db.mjs";
import { controlledServerInspect, listServers } from "../../servers/services/ServersService.mjs";
import { backupFile, createServerBackup, deleteBackup, listBackups } from "./BackupService.mjs";

const backupDirectory = process.env.BACKUP_DIR || "/backups";
const remoteBaseUrl = String(process.env.BACKUP_REMOTE_URL || "").replace(/\/$/, "");
const remoteToken = process.env.BACKUP_REMOTE_TOKEN || "";

function serverKey(inspect) {
  const prefix = "SERVER_ID=";
  const entry = (inspect.Config?.Env || []).find((value) => value.startsWith(prefix));
  return entry?.slice(prefix.length) || inspect.Config?.Labels?.["com.cs16.instance-id"] || inspect.Id.slice(0, 12);
}

function publicPolicy(row, serverId) {
  return {
    serverId,
    enabled: Boolean(row?.enabled),
    intervalHours: Number(row?.interval_hours || 24),
    retentionCount: Number(row?.retention_count || 7),
    includeLogs: row ? Boolean(row.include_logs) : true,
    includeDatabase: Boolean(row?.include_database),
    remoteEnabled: Boolean(row?.remote_enabled),
    remoteConfigured: Boolean(remoteBaseUrl),
    lastRunAt: row?.last_run_at || null,
    nextRunAt: row?.next_run_at || null,
    lastStatus: row?.last_status || null,
    lastError: row?.last_error || null,
  };
}

function nextRun(intervalHours, from = new Date()) {
  return new Date(from.getTime() + intervalHours * 60 * 60 * 1000);
}

export async function getBackupPolicy(containerId) {
  const inspect = await controlledServerInspect(containerId);
  const id = serverKey(inspect);
  const db = await new Db().db();
  return publicPolicy(await db("panel_backup_policies").where({ server_id: id }).first(), id);
}

export async function saveBackupPolicy(containerId, input) {
  const inspect = await controlledServerInspect(containerId);
  const id = serverKey(inspect);
  if (input.remoteEnabled && !remoteBaseUrl) throw new Error("Remote backup destination is not configured");
  const db = await new Db().db();
  const existing = await db("panel_backup_policies").where({ server_id: id }).first();
  const values = {
    server_id: id,
    enabled: input.enabled,
    interval_hours: input.intervalHours,
    retention_count: input.retentionCount,
    include_logs: input.includeLogs,
    include_database: input.includeDatabase,
    remote_enabled: input.remoteEnabled,
    next_run_at: input.enabled ? nextRun(input.intervalHours) : null,
    updated_at: new Date(),
  };
  if (existing) await db("panel_backup_policies").where({ server_id: id }).update(values);
  else await db("panel_backup_policies").insert(values);
  return getBackupPolicy(containerId);
}

async function uploadRemote(metadata) {
  if (!remoteBaseUrl) throw new Error("Remote backup destination is not configured");
  const { file } = await backupFile(metadata.filename);
  const response = await fetch(`${remoteBaseUrl}/${encodeURIComponent(metadata.filename)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/gzip",
      ...(remoteToken ? { Authorization: `Bearer ${remoteToken}` } : {}),
      "X-CS16-Backup-Sha256": metadata.sha256,
    },
    body: await fs.readFile(file),
  });
  if (!response.ok) throw new Error(`Remote backup upload failed with HTTP ${response.status}`);
  return { status: "uploaded", url: `${remoteBaseUrl}/${encodeURIComponent(metadata.filename)}` };
}

async function applyRetention(serverId, retentionCount) {
  const scheduled = (await listBackups(serverId)).filter((backup) => backup.kind === "scheduled");
  for (const backup of scheduled.slice(retentionCount)) await deleteBackup(backup.filename);
}

export async function runBackupPolicy(containerId, policyOverride = null) {
  const policy = policyOverride || (await getBackupPolicy(containerId));
  const metadata = await createServerBackup(containerId, {
    includeLogs: policy.includeLogs,
    includeDatabase: policy.includeDatabase,
    kind: "scheduled",
  });
  const archive = await fs.readFile(path.join(backupDirectory, metadata.filename));
  metadata.sha256 = crypto.createHash("sha256").update(archive).digest("hex");
  const remote = policy.remoteEnabled ? await uploadRemote(metadata) : null;
  await applyRetention(metadata.serverId, policy.retentionCount);
  const db = await new Db().db();
  const completedAt = new Date();
  await db("panel_backup_policies")
    .where({ server_id: metadata.serverId })
    .update({
      last_run_at: completedAt,
      next_run_at: policy.enabled ? nextRun(policy.intervalHours, completedAt) : null,
      last_status: "success",
      last_error: null,
      updated_at: completedAt,
    });
  return { backup: metadata, remote };
}

export async function runDueBackupPolicies() {
  const db = await new Db().db();
  const due = await db("panel_backup_policies")
    .where({ enabled: true })
    .whereNotNull("next_run_at")
    .where("next_run_at", "<=", new Date());
  if (!due.length) return { attempted: 0, completed: 0 };
  const servers = await listServers();
  let completed = 0;
  for (const row of due) {
    const server = servers.find((candidate) => candidate.serverId === row.server_id);
    try {
      if (!server) throw new Error("Controlled server is unavailable");
      await runBackupPolicy(server.id, publicPolicy(row, row.server_id));
      completed += 1;
    } catch (error) {
      await db("panel_backup_policies")
        .where({ server_id: row.server_id })
        .update({
          last_run_at: new Date(),
          next_run_at: nextRun(Number(row.interval_hours || 24)),
          last_status: "failed",
          last_error: String(error.message || error).slice(0, 2000),
          updated_at: new Date(),
        });
      console.error("[backup-scheduler] backup failed", { serverId: row.server_id, error: error.message });
    }
  }
  return { attempted: due.length, completed };
}
