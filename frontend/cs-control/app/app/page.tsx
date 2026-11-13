"use client";

import Link from "next/link";
import { ArrowRight, Server as ServerIcon, Users, Wifi, Network } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { useServers } from "@/components/servers/use-servers";
import { CommunityDashboard } from "@/components/analytics/community-dashboard";
import { ModerationDashboard } from "@/components/analytics/moderation-dashboard";

export default function DashboardPage() {
  const { t } = useI18n();
  const { data, loading, error } = useServers();
  const servers = data?.servers || [];
  const online = servers.filter((server) => server.state === "running");
  const players = online.reduce((sum, server) => sum + (server.players || 0), 0);
  const metrics = [
    { label: t("totalServers"), value: servers.length, icon: ServerIcon },
    { label: t("online"), value: online.length, icon: Wifi },
    { label: t("players"), value: players, icon: Users },
    { label: t("portPool"), value: data ? `${data.portRange[0]}–${data.portRange[1]}` : "—", icon: Network },
  ];
  return (
    <div className="page-stack">
      <section className="page-hero">
        <div>
          <p className="eyebrow">{t("overview")}</p>
          <h1>{t("dashboardTitle")}</h1>
          <p>{t("dashboardDescription")}</p>
        </div>
        <Link className="button primary" href="/app/servers">
          {t("manageServers")}
          <ArrowRight size={17} />
        </Link>
      </section>
      {error && <div className="error-banner">{error}</div>}
      <section className="metric-grid">
        {metrics.map(({ label, value, icon: Icon }) => (
          <article key={label}>
            <div>
              <span>{label}</span>
              <strong>{loading ? "…" : value}</strong>
            </div>
            <Icon size={20} />
          </article>
        ))}
      </section>
      <section className="panel">
        <header className="panel-heading">
          <div>
            <p className="eyebrow">{t("servers")}</p>
            <h2>{t("recentServers")}</h2>
          </div>
        </header>
        <div className="status-list">
          {servers.map((server) => (
            <Link href="/app/servers" key={server.id}>
              <span className={`server-orb ${server.state === "running" ? "live" : ""}`} />
              <strong>{server.name}</strong>
              <small>
                {server.map || server.startMap} · :{server.port}
              </small>
              <span>
                {server.players ?? "—"} / {server.liveMaxPlayers || server.maxPlayers}
              </span>
              <ArrowRight size={16} />
            </Link>
          ))}
          {!loading && servers.length === 0 && <p className="empty-copy">{t("noServers")}</p>}
        </div>
      </section>
      <CommunityDashboard />
      <ModerationDashboard />
    </div>
  );
}
