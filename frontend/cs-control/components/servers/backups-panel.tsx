"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/components/i18n-provider";
import { api } from "@/lib/api";

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
  async function create() {
    try {
      await api(`/servers/${containerId}/backups`, {
        method: "POST",
        body: JSON.stringify({ includeLogs: logs, includeDatabase: database }),
      });
      toast.success("Backup created");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "REQUEST_FAILED");
    }
  }
  async function remove(item: Backup) {
    if (!confirm(`Delete backup ${item.name}?`)) return;
    try {
      await api(`/backups/${encodeURIComponent(item.filename)}`, { method: "DELETE" });
      toast.success("Backup deleted");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "REQUEST_FAILED");
    }
  }
  async function restore(item: Backup) {
    if (!confirm("Restore this backup? A safety backup will be created first.")) return;
    const restoreDatabase =
      item.includes.database && confirm("Restore MariaDB too? All controlled servers will stop temporarily.");
    try {
      await api(`/servers/${containerId}/backups/${encodeURIComponent(item.filename)}/restore`, {
        method: "POST",
        body: JSON.stringify({ restoreLogs: item.includes.logs, restoreDatabase }),
      });
      toast.success("Backup restored");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "REQUEST_FAILED");
    }
  }
  return (
    <section className="management-panel">
      <header>
        <div>
          <p className="eyebrow">RECOVERY CENTER</p>
          <h2>{t("backupRestore")}</h2>
        </div>
        <button className="button ghost" onClick={load}>
          <RefreshCw size={15} />
          {t("refresh")}
        </button>
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
      <div className="package-list">
        {backups.map((item) => (
          <article key={item.filename}>
            <div>
              <strong>{item.kind === "safety" ? "Safety backup" : item.name}</strong>
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
              <button onClick={() => restore(item)}>
                <RotateCcw size={14} />
                {t("restore")}
              </button>
              <button className="danger-action" onClick={() => remove(item)}>
                <Trash2 size={14} />
                Delete
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
