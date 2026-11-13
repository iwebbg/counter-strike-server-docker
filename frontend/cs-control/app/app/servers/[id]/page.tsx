"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useSession } from "@/components/session-provider";
import { useI18n } from "@/components/i18n-provider";
import { useServers } from "@/components/servers/use-servers";
import { ConfigurationPanel } from "@/components/servers/configuration-panel";
import { PlayersPanel } from "@/components/servers/players-panel";
import { MapsPanel } from "@/components/servers/maps-panel";
import { AdminsPanel } from "@/components/servers/admins-panel";
import { PackagesPanel } from "@/components/servers/packages-panel";
import { BackupsPanel } from "@/components/servers/backups-panel";

const tabs = ["configuration", "players", "maps", "admins", "packages", "backups"] as const;
type Tab = (typeof tabs)[number];
export default function ServerManagementPage() {
  const { id } = useParams<{ id: string }>();
  const { data, reload } = useServers();
  const { user } = useSession();
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("configuration");
  const server = data?.servers.find((item) => item.id === id);
  const permissions = user?.permissions || [];
  const availableTabs = tabs
    .filter(
      (item) => item !== "configuration" || (server?.managedBy === "panel" && permissions.includes("servers.manage")),
    )
    .filter((item) => item !== "admins" || permissions.includes("admins.manage"))
    .filter((item) => item !== "packages" || permissions.includes("servers.manage"))
    .filter((item) => item !== "backups" || (server?.managedBy === "panel" && permissions.includes("backups.manage")));
  const availableTabsKey = availableTabs.join(",");
  useEffect(() => {
    if (!server) return;
    const requested = new URLSearchParams(window.location.search).get("tab") as Tab | null;
    setTab(requested && availableTabs.includes(requested) ? requested : availableTabs[0] || "players");
  }, [availableTabsKey, server?.id]);
  if (!server) return <p className="empty-copy">Loading server…</p>;
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
        <div className="badges">
          <span>{server.state}</span>
          <span>{server.health}</span>
        </div>
      </section>
      <nav className="detail-tabs">
        {availableTabs.map((item) => (
          <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>
            {t(item)}
          </button>
        ))}
      </nav>
      {tab === "configuration" && <ConfigurationPanel serverId={id} onUpdated={reload} />}{" "}
      {tab === "players" && <PlayersPanel serverId={id} canModerate={permissions.includes("players.moderate")} />}{" "}
      {tab === "maps" && <MapsPanel serverId={id} canManage={permissions.includes("maps.manage")} />}{" "}
      {tab === "admins" && <AdminsPanel serverId={id} />} {tab === "packages" && <PackagesPanel serverId={id} />}{" "}
      {tab === "backups" && <BackupsPanel containerId={id} serverKey={server.serverId || server.containerName} />}
    </div>
  );
}
