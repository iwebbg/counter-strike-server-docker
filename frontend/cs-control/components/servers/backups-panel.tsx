"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CloudUpload, Download, Play, RotateCcw, Save, Search, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/components/i18n-provider";
import { api } from "@/lib/api";
import { Pagination } from "@/components/ui/pagination";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Modal } from "@/components/ui/modal";

type Backup = {
  filename: string;
  name: string;
  kind: string;
  createdAt: string;
  size: number;
  includes: { data: boolean; logs: boolean; database: boolean };
};
type BackupPolicy = {
  enabled: boolean;
  intervalHours: number;
  retentionCount: number;
  includeLogs: boolean;
  includeDatabase: boolean;
  remoteEnabled: boolean;
  remoteConfigured: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  lastStatus: string | null;
  lastError: string | null;
};
const defaultPolicy: BackupPolicy = {
  enabled: false,
  intervalHours: 24,
  retentionCount: 7,
  includeLogs: true,
  includeDatabase: false,
  remoteEnabled: false,
  remoteConfigured: false,
  lastRunAt: null,
  nextRunAt: null,
  lastStatus: null,
  lastError: null,
};
export function BackupsPanel({ containerId, serverKey }: { containerId: string; serverKey: string }) {
  const toast = useToast();
  const { t } = useI18n();
  const [backups, setBackups] = useState<Backup[]>([]);
  const [logs, setLogs] = useState(false);
  const [database, setDatabase] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<Backup | null>(null);
  const [restoring, setRestoring] = useState<Backup | null>(null);
  const [restoreDatabase, setRestoreDatabase] = useState(false);
  const [pending, setPending] = useState(false);
  const [policy, setPolicy] = useState<BackupPolicy>(defaultPolicy);
  const [policyPending, setPolicyPending] = useState(false);
  const pageSize = 10;
  const load = useCallback(async () => {
    try {
      setBackups((await api<{ backups: Backup[] }>(`/backups?serverId=${encodeURIComponent(serverKey)}`)).backups);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "REQUEST_FAILED");
    }
  }, [serverKey, toast]);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    api<BackupPolicy>(`/servers/${containerId}/backup-policy`)
      .then(setPolicy)
      .catch((error) => toast.error(error instanceof Error ? error.message : "REQUEST_FAILED"));
  }, [containerId, toast]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle
      ? backups.filter((item) => `${item.name} ${item.kind} ${item.filename}`.toLowerCase().includes(needle))
      : backups;
  }, [backups, query]);
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  async function create() {
    try {
      await api(`/servers/${containerId}/backups`, {
        method: "POST",
        body: JSON.stringify({ includeLogs: logs, includeDatabase: database }),
      });
      toast.success(t("backupCreated"));
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "REQUEST_FAILED");
    }
  }
  async function remove() {
    if (!deleting) return;
    setPending(true);
    try {
      await api(`/backups/${encodeURIComponent(deleting.filename)}`, { method: "DELETE" });
      toast.success(t("backupDeleted"));
      setDeleting(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "REQUEST_FAILED");
    } finally {
      setPending(false);
    }
  }
  async function restore() {
    if (!restoring) return;
    setPending(true);
    try {
      await api(`/servers/${containerId}/backups/${encodeURIComponent(restoring.filename)}/restore`, {
        method: "POST",
        body: JSON.stringify({ restoreLogs: restoring.includes.logs, restoreDatabase }),
      });
      toast.success(t("backupRestored"));
      setRestoring(null);
      setRestoreDatabase(false);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "REQUEST_FAILED");
    } finally {
      setPending(false);
    }
  }
  async function savePolicy() {
    setPolicyPending(true);
    try {
      const saved = await api<BackupPolicy>(`/servers/${containerId}/backup-policy`, {
        method: "PUT",
        body: JSON.stringify({
          enabled: policy.enabled,
          intervalHours: policy.intervalHours,
          retentionCount: policy.retentionCount,
          includeLogs: policy.includeLogs,
          includeDatabase: policy.includeDatabase,
          remoteEnabled: policy.remoteEnabled,
        }),
      });
      setPolicy(saved);
      toast.success(t("backupPolicySaved"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "REQUEST_FAILED");
    } finally {
      setPolicyPending(false);
    }
  }
  async function runPolicy() {
    setPolicyPending(true);
    try {
      await api(`/servers/${containerId}/backup-policy/run`, { method: "POST" });
      setPolicy(await api<BackupPolicy>(`/servers/${containerId}/backup-policy`));
      toast.success(t("backupPolicyRunCompleted"));
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "REQUEST_FAILED");
    } finally {
      setPolicyPending(false);
    }
  }
  return (
    <section className="management-panel">
      <header>
        <div>
          <p className="eyebrow">{t("recoveryCenter")}</p>
          <h2>{t("backupRestore")}</h2>
        </div>
      </header>
      <div className="backup-create">
        <label>
          <input type="checkbox" checked={logs} onChange={(event) => setLogs(event.target.checked)} />{" "}
          {t("includeLogs")}
        </label>
        <label>
          <input type="checkbox" checked={database} onChange={(event) => setDatabase(event.target.checked)} />{" "}
          {t("includeDatabase")}
        </label>
        <button className="button primary" onClick={create}>
          {t("createBackup")}
        </button>
      </div>
      <div className="panel diagnostics-card">
        <header>
          <div>
            <p className="eyebrow">{t("backupAutomation")}</p>
            <h3>{t("backupPolicy")}</h3>
          </div>
          <CloudUpload size={20} />
        </header>
        <div className="form-grid">
          <label>
            <span>{t("backupIntervalHours")}</span>
            <input
              type="number"
              min={1}
              max={720}
              value={policy.intervalHours}
              onChange={(event) => setPolicy({ ...policy, intervalHours: Number(event.target.value) })}
            />
          </label>
          <label>
            <span>{t("backupRetentionCount")}</span>
            <input
              type="number"
              min={1}
              max={100}
              value={policy.retentionCount}
              onChange={(event) => setPolicy({ ...policy, retentionCount: Number(event.target.value) })}
            />
          </label>
          <label className="scope-field">
            <input
              type="checkbox"
              checked={policy.enabled}
              onChange={(event) => setPolicy({ ...policy, enabled: event.target.checked })}
            />
            {t("enableScheduledBackups")}
          </label>
          <label className="scope-field">
            <input
              type="checkbox"
              checked={policy.includeLogs}
              onChange={(event) => setPolicy({ ...policy, includeLogs: event.target.checked })}
            />
            {t("includeLogs")}
          </label>
          <label className="scope-field">
            <input
              type="checkbox"
              checked={policy.includeDatabase}
              onChange={(event) => setPolicy({ ...policy, includeDatabase: event.target.checked })}
            />
            {t("includeDatabase")}
          </label>
          <label className="scope-field">
            <input
              type="checkbox"
              checked={policy.remoteEnabled}
              disabled={!policy.remoteConfigured}
              onChange={(event) => setPolicy({ ...policy, remoteEnabled: event.target.checked })}
            />
            {t("offHostBackup")}
          </label>
        </div>
        {!policy.remoteConfigured && <p className="donation-note">{t("offHostBackupNotConfigured")}</p>}
        <p className="donation-note">
          {t("lastBackupRun")}: {policy.lastRunAt ? new Date(policy.lastRunAt).toLocaleString() : t("never")} ·{" "}
          {t("nextBackupRun")}: {policy.nextRunAt ? new Date(policy.nextRunAt).toLocaleString() : t("disabled")}
        </p>
        {policy.lastError && <p className="danger-text">{policy.lastError}</p>}
        <div className="heading-actions">
          <button className="button ghost" type="button" disabled={policyPending} onClick={runPolicy}>
            <Play size={15} />
            {t("runBackupNow")}
          </button>
          <button className="button primary" type="button" disabled={policyPending} onClick={savePolicy}>
            <Save size={15} />
            {t("saveBackupPolicy")}
          </button>
        </div>
      </div>
      <div className="table-toolbar">
        <label className="search-field">
          <Search size={16} />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder={t("search")}
          />
        </label>
      </div>
      <div className="package-list">
        {visible.map((item) => (
          <article key={item.filename}>
            <div>
              <strong>{item.kind === "safety" ? t("safetyBackup") : item.name}</strong>
              <span>
                {new Date(item.createdAt).toLocaleString()} · {(item.size / 1048576).toFixed(1)} MiB
              </span>
              <div className="badges">
                <span>AMXX</span>
                {item.includes.logs && <span>LOGS</span>}
                {item.includes.database && <span>DB</span>}
              </div>
            </div>
            <div>
              <a href={`/api/backups/${encodeURIComponent(item.filename)}/download`}>
                <Download size={14} />
                {t("download")}
              </a>
              <button onClick={() => setRestoring(item)}>
                <RotateCcw size={14} />
                {t("restore")}
              </button>
              <button className="danger-action" onClick={() => setDeleting(item)}>
                <Trash2 size={14} />
                {t("delete")}
              </button>
            </div>
          </article>
        ))}
      </div>
      <Pagination page={page} pageSize={pageSize} totalItems={filtered.length} onPageChange={setPage} />
      <ConfirmModal
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t("deleteBackup")}
        description={t("deleteBackupConfirm", { name: deleting?.name || "" })}
        confirmLabel={t("delete")}
        pending={pending}
        onConfirm={remove}
      />
      <Modal
        open={Boolean(restoring)}
        onOpenChange={(open) => !open && setRestoring(null)}
        title={t("restoreBackup")}
        eyebrow={t("recoveryCenter")}
      >
        <p className="modal-copy">{t("restoreBackupConfirm")}</p>
        {restoring?.includes.database && (
          <label className="scope-field">
            <input
              type="checkbox"
              checked={restoreDatabase}
              onChange={(event) => setRestoreDatabase(event.target.checked)}
            />
            {t("restoreDatabaseToo")}
          </label>
        )}
        <footer className="form-actions">
          <button className="button ghost" onClick={() => setRestoring(null)}>
            {t("cancel")}
          </button>
          <button className="button primary" disabled={pending} onClick={restore}>
            {t("restore")}
          </button>
        </footer>
      </Modal>
    </section>
  );
}
