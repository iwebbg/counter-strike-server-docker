"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, RotateCcw, Search, Trash2 } from "lucide-react";
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
