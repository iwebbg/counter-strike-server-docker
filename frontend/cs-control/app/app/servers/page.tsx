"use client";

import { useMemo, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { useSession } from "@/components/session-provider";
import { ServerCard } from "@/components/servers/server-card";
import { CreateServerModal } from "@/components/servers/create-server-modal";
import { useServers } from "@/components/servers/use-servers";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import type { Server } from "@/lib/types";

export default function ServersPage() {
  const { t } = useI18n();
  const { user } = useSession();
  const toast = useToast();
  const { data, loading, error, reload } = useServers();
  const [filter, setFilter] = useState("all");
  const [pending, setPending] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [logs, setLogs] = useState<{ name: string; value: string } | null>(null);
  const servers = useMemo(
    () => (data?.servers || []).filter((server) => filter === "all" || server.state === filter),
    [data, filter],
  );
  const outdated = (data?.servers || []).filter((server) => server.managedBy === "panel" && server.updateAvailable);
  async function mutate(server: Server, task: () => Promise<unknown>, success: string) {
    setPending(server.id);
    try {
      await task();
      toast.success(success);
      await reload();
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : t("requestFailed"));
    } finally {
      setPending("");
    }
  }
  const action = (server: Server, value: "start" | "stop" | "restart") =>
    mutate(server, () => api(`/servers/${server.id}/${value}`, { method: "POST" }), `${server.name}: ${value}`);
  const showLogs = async (server: Server) => {
    try {
      const result = await api<{ logs: string } | string>(`/servers/${server.id}/logs`);
      setLogs({ name: server.name, value: typeof result === "string" ? result : result.logs });
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : t("requestFailed"));
    }
  };
  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <p className="eyebrow">INSTANCES</p>
          <h1>{t("serversTitle")}</h1>
          <p>{t("serversDescription")}</p>
        </div>
        <div className="heading-actions">
          <button className="button ghost" onClick={reload}>
            <RefreshCw size={16} />
            {t("refresh")}
          </button>
          {user?.permissions.includes("servers.manage") && outdated.length > 1 && (
            <button
              className="button ghost"
              onClick={() => {
                if (!confirm(`Update ${outdated.length} servers sequentially?`)) return;
                api("/fleet/server-images", { method: "PUT" })
                  .then(() => {
                    toast.success(`${outdated.length} servers processed`);
                    reload();
                  })
                  .catch((requestError) =>
                    toast.error(requestError instanceof Error ? requestError.message : t("requestFailed")),
                  );
              }}
            >
              Update all ({outdated.length})
            </button>
          )}
          {user?.permissions.includes("servers.manage") && (
            <button className="button primary" onClick={() => setCreateOpen(true)}>
              <Plus size={17} />
              {t("newServer")}
            </button>
          )}
        </div>
      </section>
      {error && <div className="error-banner">{error}</div>}
      <div className="filter-row">
        <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>
          {t("all")}
        </button>
        <button className={filter === "running" ? "active" : ""} onClick={() => setFilter("running")}>
          {t("online")}
        </button>
        <button className={filter === "exited" ? "active" : ""} onClick={() => setFilter("exited")}>
          {t("stopped")}
        </button>
      </div>
      <section className="server-grid">
        {servers.map((server) => (
          <ServerCard
            key={server.id}
            server={server}
            permissions={user?.permissions || []}
            pending={pending === server.id}
            onAction={(value) => action(server, value)}
            onLogs={() => showLogs(server)}
            onUpdate={() =>
              mutate(server, () => api(`/servers/${server.id}/image`, { method: "PUT" }), `${server.name}: updated`)
            }
            onRemove={() => {
              if (confirm(`Remove ${server.name}? Volumes will be preserved.`))
                mutate(server, () => api(`/servers/${server.id}`, { method: "DELETE" }), `${server.name}: removed`);
            }}
          />
        ))}
      </section>
      {loading && <p className="empty-copy">{t("loading")}</p>}
      {!loading && !servers.length && <p className="empty-copy">{t("noServers")}</p>}
      <CreateServerModal open={createOpen} onOpenChange={setCreateOpen} onCreated={reload} />
      <Modal
        open={Boolean(logs)}
        onOpenChange={(open) => !open && setLogs(null)}
        title={logs?.name || t("logs")}
        eyebrow="LIVE OUTPUT"
        wide
      >
        <pre className="log-output">{logs?.value || t("loading")}</pre>
      </Modal>
    </div>
  );
}
