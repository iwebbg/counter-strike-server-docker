"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/components/session-provider";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";

type Ban = {
  id: number;
  steamId: string;
  serverId?: string;
  playerName?: string;
  reason: string;
  issuedBy: string;
  issuedAt: string;
  expiresAt?: string;
};
type Action = {
  id: number;
  serverId?: string;
  action: string;
  steamId?: string;
  playerName?: string;
  reason: string;
  createdAt: string;
};
export function ModerationDashboard() {
  const toast = useToast();
  const { user } = useSession();
  const [bans, setBans] = useState<Ban[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const load = useCallback(async () => {
    try {
      const [banData, history] = await Promise.all([
        api<{ bans: Ban[] }>("/bans"),
        api<{ actions: Action[] }>("/moderation/history"),
      ]);
      setBans(banData.bans);
      setActions(history.actions);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "REQUEST_FAILED");
    }
  }, [toast]);
  useEffect(() => {
    load();
  }, [load]);
  async function revoke(id: number) {
    if (!confirm("Revoke this ban?")) return;
    try {
      await api(`/bans/${id}/revoke`, { method: "POST" });
      toast.success("Ban revoked");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "REQUEST_FAILED");
    }
  }
  return (
    <div className="moderation-grid">
      <section className="panel">
        <header>
          <p className="eyebrow">FLEET SAFETY</p>
          <h3>Active bans</h3>
        </header>
        {bans.slice(0, 12).map((ban) => (
          <div className="community-row" key={ban.id}>
            <span>
              <strong>{ban.playerName || ban.steamId}</strong>
              <small>
                {ban.reason} · {ban.serverId || "entire fleet"}
              </small>
            </span>
            <code>{ban.expiresAt ? new Date(ban.expiresAt).toLocaleDateString() : "PERMANENT"}</code>
            {user?.permissions.includes("moderation.manage") && (
              <button className="danger-action" onClick={() => revoke(ban.id)}>
                Revoke
              </button>
            )}
          </div>
        ))}
        {!bans.length && <p className="empty-copy">No active database bans.</p>}
      </section>
      <section className="panel">
        <header>
          <p className="eyebrow">AUDIT</p>
          <h3>Moderation history</h3>
        </header>
        {actions.slice(0, 12).map((item) => (
          <div className="community-row" key={item.id}>
            <span>
              <strong>
                {item.action.toUpperCase()} · {item.playerName || item.steamId || "system"}
              </strong>
              <small>
                {item.reason} · {item.serverId || "fleet"}
              </small>
            </span>
            <code>{new Date(item.createdAt).toLocaleDateString()}</code>
          </div>
        ))}
        {!actions.length && <p className="empty-copy">No moderation events yet.</p>}
      </section>
    </div>
  );
}
