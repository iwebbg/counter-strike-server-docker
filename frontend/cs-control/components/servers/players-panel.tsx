"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/components/i18n-provider";
import { api } from "@/lib/api";

type Player = { userId: number; name: string; steamId: string; frags: number; ping: number; time: string };

export function PlayersPanel({ serverId, canModerate }: { serverId: string; canModerate: boolean }) {
  const toast = useToast();
  const { t } = useI18n();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    try {
      setPlayers((await api<{ players: Player[] }>(`/servers/${serverId}/players`)).players);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "REQUEST_FAILED");
    } finally {
      setLoading(false);
    }
  }, [serverId, toast]);
  useEffect(() => {
    load();
    const timer = window.setInterval(load, 5000);
    return () => window.clearInterval(timer);
  }, [load]);
  async function moderate(player: Player, action: "kick" | "ban") {
    const reason = prompt(`Reason for ${action}:`, "Rule violation");
    if (reason === null) return;
    let extra = {};
    if (action === "ban") {
      const minutes = Number(prompt("Ban duration in minutes (0 = permanent):", "60"));
      const scope = prompt("Scope: fleet or server", "fleet");
      if (!Number.isInteger(minutes) || minutes < 0 || !["fleet", "server"].includes(scope || "")) return;
      extra = { minutes, scope };
    }
    try {
      await api(`/servers/${serverId}/players/${player.userId}/${action}`, {
        method: "POST",
        body: JSON.stringify({ reason, ...extra }),
      });
      toast.success(`${player.name}: ${action}`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "REQUEST_FAILED");
    }
  }
  return (
    <section className="management-panel">
      <header>
        <div>
          <p className="eyebrow">LIVE MODERATION</p>
          <h2>{t("connectedPlayers")}</h2>
        </div>
        <button className="button ghost" onClick={load}>
          <RefreshCw size={15} />
          {t("refresh")}
        </button>
      </header>
      <div className="management-list player-list">
        <div className="list-head">
          <span>Player</span>
          <span>Score</span>
          <span>Ping</span>
          <span>Connected</span>
          <span />
        </div>
        {players.map((player) => (
          <div className="list-row" key={player.userId}>
            <div>
              <strong>{player.name}</strong>
              <code>{player.steamId}</code>
            </div>
            <span>{player.frags}</span>
            <span>{player.ping} ms</span>
            <span>{player.time}</span>
            <div>
              {canModerate && (
                <>
                  <button onClick={() => moderate(player, "kick")}>Kick</button>
                  <button className="danger-action" onClick={() => moderate(player, "ban")}>
                    Ban
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
        {!loading && !players.length && <p className="empty-copy">No connected players.</p>}
      </div>
    </section>
  );
}
