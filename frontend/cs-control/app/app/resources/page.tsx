"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DatabaseBackup, HardDrive, RefreshCw, Search, Trash2 } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";

type Resource = {
  serverId: string;
  name?: string;
  mode?: string;
  classification: "managed" | "recoverable" | "legacy" | "orphaned" | "stale-registry" | "untracked";
  bytes: number;
  container?: { state: string };
  definition?: { desiredState: string; lastError?: string | null };
  registry?: { state: string; lastHeartbeat?: string };
  volumes: Array<{ name: string; kind: string; size: number; refCount: number }>;
};
type Payload = {
  resources: Resource[];
  summary: { total: number; recoverable: number; retained: number; reclaimableBytes: number };
};

const pageSize = 10;
const empty: Payload = { resources: [], summary: { total: 0, recoverable: 0, retained: 0, reclaimableBytes: 0 } };

function formatBytes(value: number) {
  if (!value) return "0 B";
  const unit = Math.min(3, Math.floor(Math.log(value) / Math.log(1024)));
  return `${(value / 1024 ** unit).toFixed(unit ? 1 : 0)} ${["B", "KB", "MB", "GB"][unit]}`;
}

export default function ResourcesPage() {
  const { t } = useI18n();
  const toast = useToast();
  const [data, setData] = useState(empty);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState(false);
  const [recoverTarget, setRecoverTarget] = useState<Resource | null>(null);
  const [cleanupTarget, setCleanupTarget] = useState<Resource | null>(null);
  const [removeVolumes, setRemoveVolumes] = useState(true);
  const [removeRegistry, setRemoveRegistry] = useState(false);
  const [startRecovered, setStartRecovered] = useState(true);

  const load = useCallback(async () => {
    try {
      setData(await api<Payload>("/managed-resources"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("requestFailed"));
    }
  }, [t, toast]);
  useEffect(() => void load(), [load]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle
      ? data.resources.filter((resource) =>
          [resource.serverId, resource.name, resource.mode, resource.classification]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(needle)),
        )
      : data.resources;
  }, [data.resources, query]);
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => setPage(1), [query]);

  const label = (classification: Resource["classification"]) =>
    t(
      (
        {
          managed: "resourceManaged",
          recoverable: "resourceRecoverable",
          legacy: "resourceLegacy",
          orphaned: "resourceOrphaned",
          "stale-registry": "resourceStaleRegistry",
          untracked: "resourceUntracked",
        } as const
      )[classification],
    );

  async function reconcile(resource: Resource) {
    setPending(true);
    try {
      await api(`/managed-resources/${resource.serverId}/reconcile`, { method: "POST" });
      toast.success(t("resourceRecovered"));
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("requestFailed"));
    } finally {
      setPending(false);
    }
  }

  async function recover() {
    if (!recoverTarget) return;
    setPending(true);
    try {
      const result = await api<{ rconPassword: string }>(`/managed-resources/${recoverTarget.serverId}/recover`, {
        method: "POST",
        body: JSON.stringify({ startImmediately: startRecovered, rconPassword: "" }),
      });
      toast.success(t("resourceRecovered"), `RCON: ${result.rconPassword}`);
      setRecoverTarget(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("requestFailed"));
    } finally {
      setPending(false);
    }
  }

  async function cleanup() {
    if (!cleanupTarget || (!removeVolumes && !removeRegistry)) return;
    setPending(true);
    try {
      await api(`/managed-resources/${cleanupTarget.serverId}`, {
        method: "DELETE",
        body: JSON.stringify({ removeVolumes, removeRegistry }),
      });
      toast.success(t("resourceCleaned"));
      setCleanupTarget(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("requestFailed"));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{t("resourcesEyebrow")}</p>
          <h1>{t("resourcesTitle")}</h1>
          <p>{t("resourcesDescription")}</p>
        </div>
      </div>
      <section className="metric-grid resource-metrics">
        <article>
          <DatabaseBackup />
          <span>{t("recoverableResources")}</span>
          <strong>{data.summary.recoverable}</strong>
        </article>
        <article>
          <HardDrive />
          <span>{t("retainedResources")}</span>
          <strong>{data.summary.retained}</strong>
        </article>
        <article>
          <Trash2 />
          <span>{t("reclaimableSpace")}</span>
          <strong>{formatBytes(data.summary.reclaimableBytes)}</strong>
        </article>
      </section>
      <section className="panel table-panel resource-panel">
        <div className="table-toolbar">
          <label className="search-field">
            <Search size={17} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("search")} />
          </label>
          <button className="button ghost" onClick={load}>
            <RefreshCw size={16} />
            {t("refresh")}
          </button>
        </div>
        <div className="resource-table-head">
          <span>{t("servers")}</span>
          <span>{t("resourceType")}</span>
          <span>{t("storage")}</span>
          <span>{t("action")}</span>
        </div>
        {visible.map((resource) => (
          <article className="resource-row" key={resource.serverId}>
            <div>
              <strong>{resource.name || resource.serverId}</strong>
              <small>
                {resource.serverId} · {resource.mode || "—"}
              </small>
            </div>
            <div>
              <span className={`resource-state ${resource.classification}`}>{label(resource.classification)}</span>
              <small>
                {resource.definition?.desiredState || resource.container?.state || resource.registry?.state || "—"}
              </small>
            </div>
            <div>
              <strong>{formatBytes(resource.bytes)}</strong>
              <small>{resource.volumes.map((volume) => volume.kind).join(" + ") || "—"}</small>
            </div>
            <div className="resource-actions">
              {resource.classification === "recoverable" && (
                <button className="button ghost" disabled={pending} onClick={() => reconcile(resource)}>
                  {t("reconcile")}
                </button>
              )}
              {resource.classification === "legacy" && (
                <button className="button ghost" onClick={() => setRecoverTarget(resource)}>
                  {t("recoverResource")}
                </button>
              )}
              {["legacy", "orphaned", "stale-registry"].includes(resource.classification) && (
                <button
                  className="button danger-button"
                  onClick={() => {
                    setCleanupTarget(resource);
                    setRemoveVolumes(resource.volumes.length > 0);
                    setRemoveRegistry(Boolean(resource.registry));
                  }}
                >
                  {t("cleanupResource")}
                </button>
              )}
            </div>
          </article>
        ))}
        {!visible.length && <p className="empty-state">{t("noResources")}</p>}
        <Pagination page={page} pageSize={pageSize} totalItems={filtered.length} onPageChange={setPage} />
      </section>

      <Modal
        open={Boolean(recoverTarget)}
        onOpenChange={(open) => !open && setRecoverTarget(null)}
        title={t("recoverResource")}
        eyebrow={t("resourcesEyebrow")}
      >
        <p className="modal-copy">{recoverTarget?.name || recoverTarget?.serverId}</p>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={startRecovered}
            onChange={(event) => setStartRecovered(event.target.checked)}
          />
          <span>{t("startRecovered")}</span>
        </label>
        <footer className="form-actions">
          <button className="button ghost" onClick={() => setRecoverTarget(null)}>
            {t("cancel")}
          </button>
          <button className="button primary" disabled={pending} onClick={recover}>
            {t("recoverResource")}
          </button>
        </footer>
      </Modal>
      <Modal
        open={Boolean(cleanupTarget)}
        onOpenChange={(open) => !open && setCleanupTarget(null)}
        title={t("cleanupResource")}
        eyebrow={t("confirmation")}
      >
        <p className="modal-copy">{t("cleanupResourceDescription", { id: cleanupTarget?.serverId || "" })}</p>
        <div className="stacked-checks">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={removeVolumes}
              disabled={!cleanupTarget?.volumes.length}
              onChange={(event) => setRemoveVolumes(event.target.checked)}
            />
            <span>{t("removeVolumes")}</span>
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={removeRegistry}
              disabled={!cleanupTarget?.registry}
              onChange={(event) => setRemoveRegistry(event.target.checked)}
            />
            <span>{t("removeRegistry")}</span>
          </label>
        </div>
        <footer className="form-actions">
          <button className="button ghost" onClick={() => setCleanupTarget(null)}>
            {t("cancel")}
          </button>
          <button
            className="button danger-button"
            disabled={pending || (!removeVolumes && !removeRegistry)}
            onClick={cleanup}
          >
            {t("cleanupResource")}
          </button>
        </footer>
      </Modal>
    </>
  );
}
