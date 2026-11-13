"use client";

import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { useSession } from "@/components/session-provider";
import { ServerCard } from "@/components/servers/server-card";
import { CreateServerModal } from "@/components/servers/create-server-modal";
import { useServers } from "@/components/servers/use-servers";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { Pagination } from "@/components/ui/pagination";
import { api } from "@/lib/api";
import type { Server } from "@/lib/types";

export default function ServersPage() {
  const { t } = useI18n();
  const { user } = useSession();
  const toast = useToast();
  const { data, loading, error, reload } = useServers();
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [logs, setLogs] = useState<{ name: string; value: string } | null>(null);
  const servers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (data?.servers || []).filter(
      (server) =>
        (filter === "all" || server.state === filter) &&
        (!needle ||
          [server.name, server.containerName, server.mode, server.map || ""].some((value) =>
            value.toLowerCase().includes(needle),
          )),
    );
  }, [data, filter, query]);
  const pageSize = 6;
  const serverReference = (server: Server) => server.serverId || server.id;
  const visibleServers = servers.slice((page - 1) * pageSize, page * pageSize);
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
  const action = (server: Server, value: "start" | "stop" | "restart" | "pause" | "unpause") =>
    mutate(
      server,
      () => api(`/servers/${serverReference(server)}/${value}`, { method: "POST" }),
      `${server.name}: ${value}`,
    );
  const showLogs = async (server: Server) => {
    try {
      const result = await api<{ logs: string } | string>(`/servers/${serverReference(server)}/logs`);
      setLogs({ name: server.name, value: typeof result === "string" ? result : result.logs });
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : t("requestFailed"));
    }
  };
  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <p className="eyebrow">{t("instances")}</p>
          <h1>{t("serversTitle")}</h1>
          <p>{t("serversDescription")}</p>
        </div>
        <div className="heading-actions">
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
      <div className="list-controls">
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
        <div className="filter-row">
          <button
            className={filter === "all" ? "active" : ""}
            onClick={() => {
              setFilter("all");
              setPage(1);
            }}
          >
            {t("all")}
          </button>
          <button
            className={filter === "running" ? "active" : ""}
            onClick={() => {
              setFilter("running");
              setPage(1);
            }}
          >
            {t("online")}
          </button>
          <button
            className={filter === "exited" ? "active" : ""}
            onClick={() => {
              setFilter("exited");
              setPage(1);
            }}
          >
            {t("stopped")}
          </button>
        </div>
      </div>
      <section className="server-grid">
        {visibleServers.map((server) => (
          <ServerCard
            key={server.id}
            server={server}
            permissions={user?.permissions || []}
            pending={pending === server.id}
            onAction={(value) => action(server, value)}
            onLogs={() => showLogs(server)}
            onUpdate={() =>
              mutate(
                server,
                () => api(`/servers/${serverReference(server)}/image`, { method: "PUT" }),
                `${server.name}: updated`,
              )
            }
            onRemove={() => {
              if (confirm(`Remove ${server.name}? Volumes will be preserved.`))
                mutate(
                  server,
                  () => api(`/servers/${serverReference(server)}`, { method: "DELETE" }),
                  `${server.name}: removed`,
                );
            }}
          />
        ))}
      </section>
      <Pagination page={page} pageSize={pageSize} totalItems={servers.length} onPageChange={setPage} />
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
