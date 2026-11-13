"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { useSession } from "@/components/session-provider";
import { api } from "@/lib/api";

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
  const { user } = useSession();
  const [data, setData] = useState<Overview | null>(null);
  const [status, setStatus] = useState<{ enabled: boolean; connected: boolean } | null>(null);
  const [server, setServer] = useState("");
  const [season, setSeason] = useState("");
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
  async function createSeason() {
    const name = prompt("New season name", "Season 2");
    if (!name) return;
    try {
      await api("/seasons", { method: "POST", body: JSON.stringify({ name }) });
      toast.success(`${name}: active season`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "REQUEST_FAILED");
    }
  }
  if (status && !status.connected)
    return (
      <section className="panel database-disabled">
        <strong>MariaDB analytics are optional.</strong>
        <span>Enable the database stack to display rankings, sessions and achievements.</span>
      </section>
    );
  const summary = data?.summary;
  return (
    <section className="community-section">
      <header className="community-heading">
        <div>
          <p className="eyebrow">COMMUNITY DATA</p>
          <h2>Stats & moderation</h2>
        </div>
        <div>
          <span className={`database-badge ${status?.connected ? "connected" : ""}`}>
            {status?.connected ? "MARIADB CONNECTED" : "CHECKING MARIADB…"}
          </span>
          <select value={server} onChange={(event) => setServer(event.target.value)}>
            <option value="">All servers</option>
            {data?.servers.map((item) => (
              <option key={item.serverId} value={item.serverId}>
                {item.name}
              </option>
            ))}
          </select>
          <select value={season} onChange={(event) => setSeason(event.target.value)}>
            <option value="">All time</option>
            {data?.seasons.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          {user?.permissions.includes("seasons.manage") && (
            <button className="button ghost" onClick={createSeason}>
              ＋ Season
            </button>
          )}
          <button className="icon-button" onClick={load}>
            <RefreshCw size={16} />
          </button>
        </div>
      </header>
      <div className="community-metrics">
        <article>
          <span>Players</span>
          <strong>{summary?.players || 0}</strong>
          <small>unique Steam IDs</small>
        </article>
        <article>
          <span>Kills</span>
          <strong>{summary?.kills || 0}</strong>
          <small>{((summary?.kills || 0) / Math.max(summary?.deaths || 0, 1)).toFixed(2)} fleet K/D</small>
        </article>
        <article>
          <span>Headshots</span>
          <strong>{summary?.headshots || 0}</strong>
          <small>{Math.round(((summary?.headshots || 0) / Math.max(summary?.kills || 0, 1)) * 100)}% of kills</small>
        </article>
        <article>
          <span>Playtime</span>
          <strong>{duration(summary?.playtimeSeconds || 0)}</strong>
          <small>{summary?.gungameWins || 0} GunGame wins</small>
        </article>
      </div>
      <div className="community-grid">
        <article className="panel ranking">
          <header>
            <p className="eyebrow">LEADERBOARD</p>
            <h3>Top players</h3>
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
            <p className="eyebrow">ROTATION</p>
            <h3>Popular maps</h3>
          </header>
          {data?.maps.slice(0, 8).map((map) => (
            <div className="community-row" key={map.mapName}>
              <span>
                <strong>{map.mapName}</strong>
                <small>{map.kills} kills</small>
              </span>
              <code>{map.timesPlayed}×</code>
            </div>
          ))}
        </article>
        <article className="panel">
          <header>
            <p className="eyebrow">ACTIVITY</p>
            <h3>Recent sessions</h3>
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
            <p className="eyebrow">PROGRESSION</p>
            <h3>Achievements</h3>
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
    </section>
  );
}
