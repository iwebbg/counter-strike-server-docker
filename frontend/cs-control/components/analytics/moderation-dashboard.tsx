"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/components/session-provider";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { useI18n } from "@/components/i18n-provider";
import { ConfirmModal } from "@/components/ui/confirm-modal";

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
  const { t, locale } = useI18n();
  const [bans, setBans] = useState<Ban[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [revokeId, setRevokeId] = useState<number | null>(null);
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
  async function revoke() {
    if (revokeId === null) return;
    try {
      await api(`/bans/${revokeId}/revoke`, { method: "POST" });
      toast.success(t("banRevoked"));
      setRevokeId(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "REQUEST_FAILED");
    }
  }
  return (
    <div className="moderation-grid">
      <section className="panel">
        <header>
          <p className="eyebrow">{t("fleetSafety")}</p>
          <h3>{t("activeBans")}</h3>
        </header>
        {bans.slice(0, 12).map((ban) => (
          <div className="community-row" key={ban.id}>
            <span>
              <strong>{ban.playerName || ban.steamId}</strong>
              <small>
                {ban.reason} · {ban.serverId || t("entireFleet")}
              </small>
            </span>
            <code>
              {ban.expiresAt
                ? new Date(ban.expiresAt).toLocaleDateString(locale === "bg" ? "bg-BG" : "en-GB")
                : t("permanent")}
            </code>
            {user?.permissions.includes("moderation.manage") && (
              <button className="danger-action" onClick={() => setRevokeId(ban.id)}>
                {t("revoke")}
              </button>
            )}
          </div>
        ))}
        {!bans.length && <p className="empty-copy">{t("noActiveBans")}</p>}
      </section>
      <section className="panel">
        <header>
          <p className="eyebrow">{t("audit")}</p>
          <h3>{t("moderationHistory")}</h3>
        </header>
        {actions.slice(0, 12).map((item) => (
          <div className="community-row" key={item.id}>
            <span>
              <strong>
                {item.action.toUpperCase()} · {item.playerName || item.steamId || t("system")}
              </strong>
              <small>
                {item.reason} · {item.serverId || t("fleet")}
              </small>
            </span>
            <code>{new Date(item.createdAt).toLocaleDateString(locale === "bg" ? "bg-BG" : "en-GB")}</code>
          </div>
        ))}
        {!actions.length && <p className="empty-copy">{t("noModerationEvents")}</p>}
      </section>
      <ConfirmModal
        open={revokeId !== null}
        onOpenChange={(open) => !open && setRevokeId(null)}
        title={t("revokeBan")}
        description={t("revokeBanConfirm")}
        confirmLabel={t("revoke")}
        onConfirm={revoke}
      />
    </div>
  );
}
