"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useToast } from "@/components/ui/toast";
import { useSession } from "@/components/session-provider";
import { api } from "@/lib/api";
import { useI18n } from "@/components/i18n-provider";
import { Modal } from "@/components/ui/modal";

type Overview = {
  summary: {
    players: number;
    kills: number;
    deaths: number;
    headshots: number;
    playtimeSeconds: number;
    gungameWins: number;
  };
  ranking: Array<{
    steamId: string;
    name: string;
    kills: number;
    deaths: number;
    kd: number;
    headshots: number;
    playtimeSeconds: number;
  }>;
  maps: Array<{ mapName: string; timesPlayed: number; kills: number }>;
  sessions: Array<{ steamId: string; name: string; serverId: string; connectedAt: string; playtimeSeconds: number }>;
  achievements: Array<{ steamId: string; name: string; achievement: string; description: string }>;
  seasons: Array<{ id: number; name: string }>;
  servers: Array<{ serverId: string; name: string }>;
};
const duration = (seconds: number) =>
  seconds < 3600
    ? `${Math.floor(seconds / 60)}m`
    : seconds < 86400
      ? `${(seconds / 3600).toFixed(1)}h`
      : `${(seconds / 86400).toFixed(1)}d`;
export function CommunityDashboard() {
  const toast = useToast();
  const { t } = useI18n();
  const { user } = useSession();
  const [data, setData] = useState<Overview | null>(null);
  const [status, setStatus] = useState<{ enabled: boolean; connected: boolean } | null>(null);
  const [server, setServer] = useState("");
  const [season, setSeason] = useState("");
  const [seasonOpen, setSeasonOpen] = useState(false);
  const load = useCallback(async () => {
    try {
      const db = await api<{ enabled: boolean; connected: boolean }>("/database/status");
      setStatus(db);
      if (!db.connected) return;
      const params = new URLSearchParams();
      if (server) params.set("serverId", server);
      if (season) params.set("seasonId", season);
      setData(await api<Overview>(`/stats/overview${params.size ? `?${params}` : ""}`));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "REQUEST_FAILED");
    }
  }, [server, season, toast]);
  useEffect(() => {
    load();
  }, [load]);
  async function createSeason(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get("name") || "").trim();
    if (!name) return;
    try {
      await api("/seasons", { method: "POST", body: JSON.stringify({ name }) });
      toast.success(t("seasonCreated", { name }));
      setSeasonOpen(false);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "REQUEST_FAILED");
    }
  }
  if (status && !status.connected)
    return (
      <section className="panel database-disabled">
        <strong>{t("mariadbOptional")}</strong>
        <span>{t("mariadbEnableHint")}</span>
      </section>
    );
  const summary = data?.summary;
  return (
    <section className="community-section">
      <header className="community-heading">
        <div>
          <p className="eyebrow">{t("communityData")}</p>
          <h2>{t("statsModeration")}</h2>
        </div>
        <div>
          <span className={`database-badge ${status?.connected ? "connected" : ""}`}>
            {t(status?.connected ? "mariadbConnected" : "checkingMariaDb")}
          </span>
          <select value={server} onChange={(event) => setServer(event.target.value)}>
            <option value="">{t("allServers")}</option>
            {data?.servers.map((item) => (
              <option key={item.serverId} value={item.serverId}>
                {item.name}
              </option>
            ))}
          </select>
          <select value={season} onChange={(event) => setSeason(event.target.value)}>
            <option value="">{t("allTime")}</option>
            {data?.seasons.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          {user?.permissions.includes("seasons.manage") && (
            <button className="button ghost" onClick={() => setSeasonOpen(true)}>
              ＋ {t("newSeason")}
            </button>
          )}
        </div>
      </header>
      <div className="community-metrics">
        <article>
          <span>{t("players")}</span>
          <strong>{summary?.players || 0}</strong>
          <small>{t("uniqueSteamIds")}</small>
        </article>
        <article>
          <span>{t("kills")}</span>
          <strong>{summary?.kills || 0}</strong>
          <small>
            {((summary?.kills || 0) / Math.max(summary?.deaths || 0, 1)).toFixed(2)} {t("fleetKd")}
          </small>
        </article>
        <article>
          <span>{t("headshots")}</span>
          <strong>{summary?.headshots || 0}</strong>
          <small>
            {Math.round(((summary?.headshots || 0) / Math.max(summary?.kills || 0, 1)) * 100)}% {t("percentOfKills")}
          </small>
        </article>
        <article>
          <span>{t("playtime")}</span>
          <strong>{duration(summary?.playtimeSeconds || 0)}</strong>
          <small>
            {summary?.gungameWins || 0} {t("gungameWins")}
          </small>
        </article>
      </div>
      <div className="community-grid">
        <article className="panel ranking">
          <header>
            <p className="eyebrow">{t("leaderboard")}</p>
            <h3>{t("topPlayers")}</h3>
          </header>
          {data?.ranking.slice(0, 10).map((player, index) => (
            <div className="community-row" key={player.steamId}>
              <b>#{index + 1}</b>
              <span>
                <strong>{player.name}</strong>
                <small>{player.steamId}</small>
              </span>
              <code>
                {player.kills} K · {player.kd} K/D
              </code>
            </div>
          ))}
        </article>
        <article className="panel">
          <header>
            <p className="eyebrow">{t("rotation")}</p>
            <h3>{t("popularMaps")}</h3>
          </header>
          {data?.maps.slice(0, 8).map((map) => (
            <div className="community-row" key={map.mapName}>
              <span>
                <strong>{map.mapName}</strong>
                <small>
                  {map.kills} {t("kills")}
                </small>
              </span>
              <code>{map.timesPlayed}×</code>
            </div>
          ))}
        </article>
        <article className="panel">
          <header>
            <p className="eyebrow">{t("activity")}</p>
            <h3>{t("recentSessions")}</h3>
          </header>
          {data?.sessions.slice(0, 8).map((session, index) => (
            <div className="community-row" key={`${session.steamId}-${index}`}>
              <span>
                <strong>{session.name}</strong>
                <small>{session.serverId}</small>
              </span>
              <code>{duration(session.playtimeSeconds)}</code>
            </div>
          ))}
        </article>
        <article className="panel">
          <header>
            <p className="eyebrow">{t("progression")}</p>
            <h3>{t("achievements")}</h3>
          </header>
          {data?.achievements.slice(0, 8).map((item, index) => (
            <div className="community-row" key={`${item.steamId}-${index}`}>
              <span>
                <strong>{item.achievement}</strong>
                <small>{item.name}</small>
              </span>
            </div>
          ))}
        </article>
      </div>
      <Modal open={seasonOpen} onOpenChange={setSeasonOpen} title={t("newSeason")} eyebrow={t("communityData")}>
        <form className="form-grid" onSubmit={createSeason}>
          <label className="full">
            <span>{t("newSeasonName")}</span>
            <input name="name" required autoFocus />
          </label>
          <footer className="form-actions full">
            <button type="button" className="button ghost" onClick={() => setSeasonOpen(false)}>
              {t("cancel")}
            </button>
            <button className="button primary">{t("save")}</button>
          </footer>
        </form>
      </Modal>
    </section>
  );
}
