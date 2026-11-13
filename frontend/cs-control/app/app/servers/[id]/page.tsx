"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, FileText, Pause, Play, RefreshCw, Square, Upload } from "lucide-react";
import { useSession } from "@/components/session-provider";
import { useI18n } from "@/components/i18n-provider";
import { useServers } from "@/components/servers/use-servers";
import { ConfigurationPanel } from "@/components/servers/configuration-panel";
import { PlayersPanel } from "@/components/servers/players-panel";
import { MapsPanel } from "@/components/servers/maps-panel";
import { AdminsPanel } from "@/components/servers/admins-panel";
import { PackagesPanel } from "@/components/servers/packages-panel";
import { BackupsPanel } from "@/components/servers/backups-panel";
import { EvidencePanel } from "@/components/servers/evidence-panel";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";

const tabs = ["configuration", "players", "maps", "admins", "packages", "backups", "evidence"] as const;
type Tab = (typeof tabs)[number];
export default function ServerManagementPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, reload } = useServers();
  const { user } = useSession();
  const { t } = useI18n();
  const toast = useToast();
  const [tab, setTab] = useState<Tab | null>(null);
  const [pending, setPending] = useState(false);
  const [logs, setLogs] = useState<string | null>(null);
  const server = data?.servers.find((item) => item.serverId === id || item.id === id);
  const permissions = user?.permissions || [];
  const availableTabs = tabs
    .filter(
      (item) => item !== "configuration" || (server?.managedBy === "panel" && permissions.includes("servers.manage")),
    )
    .filter((item) => item !== "admins" || permissions.includes("admins.manage"))
    .filter((item) => item !== "packages" || permissions.includes("servers.manage"))
    .filter((item) => item !== "backups" || (server?.managedBy === "panel" && permissions.includes("backups.manage")))
    .filter((item) => item !== "evidence" || permissions.includes("moderation.manage"));
  const availableTabsKey = availableTabs.join(",");
  useEffect(() => {
    if (!server) return;
    const requested = new URLSearchParams(window.location.search).get("tab") as Tab | null;
    setTab(requested && availableTabs.includes(requested) ? requested : availableTabs[0] || "players");
  }, [availableTabsKey, server?.id]);
  if (!server) return <p className="empty-copy">{t("loadingServer")}</p>;
  const canOperate = permissions.includes("servers.operate");
  async function action(value: "start" | "stop" | "restart" | "pause" | "unpause") {
    setPending(true);
    try {
      await api(`/servers/${id}/${value}`, { method: "POST" });
      toast.success(
        value === "pause" ? t("serverPaused") : value === "unpause" ? t("serverResumed") : t("serverActionComplete"),
      );
      await reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("requestFailed"));
    } finally {
      setPending(false);
    }
  }
  async function showLogs() {
    try {
      const result = await api<{ logs: string } | string>(`/servers/${id}/logs`);
      setLogs(typeof result === "string" ? result : result.logs);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("requestFailed"));
    }
  }
  async function updateImage() {
    setPending(true);
    try {
      await api(`/servers/${id}/image`, { method: "PUT" });
      toast.success(t("serverActionComplete"));
      await reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("requestFailed"));
    } finally {
      setPending(false);
    }
  }
  function selectTab(next: Tab) {
    setTab(next);
    window.history.replaceState(null, "", `${window.location.pathname}?tab=${next}`);
  }
  async function configurationUpdated(nextServerReference: string) {
    router.replace(`/app/servers/${nextServerReference}?tab=configuration`);
    await reload();
  }
  return (
    <div className="page-stack">
      <Link className="back-link" href="/app/servers">
        <ArrowLeft size={16} />
        {t("backToServers")}
      </Link>
      <section className="page-heading server-detail-heading">
        <div>
          <p className="eyebrow">{t("manageInstance")}</p>
          <h1>{server.name}</h1>
          <p>
            {server.containerName} · {server.mode} · :{server.port}
          </p>
        </div>
        <div className="server-detail-actions">
          <div className="badges">
            <span>{server.state}</span>
            <span>{server.health}</span>
          </div>
          <div className="heading-actions">
            {canOperate && server.state === "running" && (
              <>
                <button className="button ghost" disabled={pending} onClick={() => action("stop")}>
                  <Square size={14} />
                  {t("stop")}
                </button>
                <button className="button ghost" disabled={pending} onClick={() => action("restart")}>
                  <RefreshCw size={14} />
                  {t("restart")}
                </button>
                <button className="button ghost" disabled={pending} onClick={() => action("pause")}>
                  <Pause size={14} />
                  {t("pause")}
                </button>
              </>
            )}
            {canOperate && server.state === "paused" && (
              <>
                <button className="button primary" disabled={pending} onClick={() => action("unpause")}>
                  <Play size={14} />
                  {t("resume")}
                </button>
                <button className="button ghost" disabled={pending} onClick={() => action("stop")}>
                  <Square size={14} />
                  {t("stop")}
                </button>
              </>
            )}
            {canOperate && !["running", "paused"].includes(server.state) && (
              <button className="button primary" disabled={pending} onClick={() => action("start")}>
                <Play size={14} />
                {t("startServer")}
              </button>
            )}
            <button className="button ghost" onClick={showLogs}>
              <FileText size={14} />
              {t("logs")}
            </button>
            {permissions.includes("servers.manage") && server.updateAvailable && (
              <button className="button ghost" disabled={pending} onClick={updateImage}>
                <Upload size={14} />
                {t("update")}
              </button>
            )}
          </div>
        </div>
      </section>
      <nav className="detail-tabs">
        {availableTabs.map((item) => (
          <button key={item} className={tab === item ? "active" : ""} onClick={() => selectTab(item)}>
            {t(item)}
          </button>
        ))}
      </nav>
      {tab === "configuration" && <ConfigurationPanel serverId={id} onUpdated={configurationUpdated} />}{" "}
      {tab === "players" && <PlayersPanel serverId={id} canModerate={permissions.includes("players.moderate")} />}{" "}
      {tab === "maps" && <MapsPanel serverId={id} canManage={permissions.includes("maps.manage")} />}{" "}
      {tab === "admins" && <AdminsPanel serverId={id} />} {tab === "packages" && <PackagesPanel serverId={id} />}{" "}
      {tab === "backups" && <BackupsPanel containerId={id} serverKey={server.serverId || server.containerName} />}
      {tab === "evidence" && <EvidencePanel serverId={id} />}
      <Modal
        open={logs !== null}
        onOpenChange={(open) => !open && setLogs(null)}
        title={server.name}
        eyebrow={t("liveOutput")}
        wide
      >
        <pre className="log-output">{logs}</pre>
      </Modal>
    </div>
  );
}
