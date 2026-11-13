"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/components/i18n-provider";
import { api } from "@/lib/api";
import { Pagination } from "@/components/ui/pagination";

type Player = { userId: number; name: string; steamId: string; frags: number; ping: number; time: string };

export function PlayersPanel({ serverId, canModerate }: { serverId: string; canModerate: boolean }) {
  const toast = useToast();
  const { t } = useI18n();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;
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
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle
      ? players.filter((player) => `${player.name} ${player.steamId}`.toLowerCase().includes(needle))
      : players;
  }, [players, query]);
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  async function moderate(player: Player, action: "kick" | "ban") {
    const reason = prompt(`${t("reason")} (${t(action === "kick" ? "kick" : "ban")}):`, t("ruleViolation"));
    if (reason === null) return;
    let extra = {};
    if (action === "ban") {
      const minutes = Number(prompt(t("banDuration"), "60"));
      const scope = prompt(`${t("banScope")}: fleet / server`, "fleet");
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
          <p className="eyebrow">{t("liveModeration")}</p>
          <h2>{t("connectedPlayers")}</h2>
        </div>
      </header>
      <div className="table-toolbar">
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
      </div>
      <div className="management-list player-list">
        <div className="list-head">
          <span>{t("player")}</span>
          <span>{t("score")}</span>
          <span>{t("ping")}</span>
          <span>{t("connected")}</span>
          <span />
        </div>
        {visible.map((player) => (
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
                  <button onClick={() => moderate(player, "kick")}>{t("kick")}</button>
                  <button className="danger-action" onClick={() => moderate(player, "ban")}>
                    {t("ban")}
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
        {!loading && !players.length && <p className="empty-copy">{t("noConnectedPlayers")}</p>}
        <Pagination page={page} pageSize={pageSize} totalItems={filtered.length} onPageChange={setPage} />
      </div>
    </section>
  );
}
