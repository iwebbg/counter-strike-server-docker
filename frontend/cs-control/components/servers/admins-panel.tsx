"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/components/i18n-provider";
import { api } from "@/lib/api";

type Admin = { steamId: string; flags: string };
const roles = { full: "abcdefghijklmnopqrstu", moderator: "bcdefijm", maps: "fj" };
export function AdminsPanel({ serverId }: { serverId: string }) {
  const toast = useToast();
  const { t } = useI18n();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [source, setSource] = useState("");
  const [fleet, setFleet] = useState(false);
  const load = useCallback(async () => {
    try {
      const result = await api<{ admins: Admin[]; source: string }>(`/servers/${serverId}/admins`);
      setAdmins(result.admins);
      setSource(result.source);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "REQUEST_FAILED");
    }
  }, [serverId, toast]);
  useEffect(() => {
    load();
  }, [load]);
  const patch = (index: number, values: Partial<Admin>) =>
    setAdmins((current) => current.map((admin, item) => (item === index ? { ...admin, ...values } : admin)));
  async function save() {
    try {
      await api(`/servers/${serverId}/admins`, {
        method: "PUT",
        body: JSON.stringify({ admins: admins.filter((admin) => admin.steamId), scope: fleet ? "fleet" : "server" }),
      });
      toast.success("Admins saved and reloaded live");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "REQUEST_FAILED");
    }
  }
  async function reset() {
    if (!confirm("Reset admins to .env?")) return;
    try {
      await api(`/servers/${serverId}/admins`, { method: "DELETE" });
      toast.success("Admins reset");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "REQUEST_FAILED");
    }
  }
  return (
    <section className="management-panel">
      <header>
        <div>
          <p className="eyebrow">LIVE AMX MOD X ACCESS</p>
          <h2>{t("serverAdmins")}</h2>
        </div>
        <div className="badges">
          <span>{source || "—"}</span>
        </div>
      </header>
      <div className="admin-management">
        {admins.map((admin, index) => (
          <div className="admin-management-row" key={`${index}-${admin.steamId}`}>
            <input
              value={admin.steamId}
              pattern="STEAM_[0-9]+:[01]:[0-9]+"
              placeholder="STEAM_0:1:123456"
              onChange={(event) => patch(index, { steamId: event.target.value })}
            />
            <select
              value={Object.entries(roles).find(([, flags]) => flags === admin.flags)?.[0] || "custom"}
              onChange={(event) =>
                event.target.value !== "custom" &&
                patch(index, { flags: roles[event.target.value as keyof typeof roles] })
              }
            >
              <option value="full">Full admin</option>
              <option value="moderator">Moderator</option>
              <option value="maps">Maps & votes</option>
              <option value="custom">Custom flags</option>
            </select>
            <input
              value={admin.flags}
              pattern="[a-u]+"
              onChange={(event) => patch(index, { flags: event.target.value })}
            />
            <button
              className="danger-action"
              onClick={() => setAdmins((current) => current.filter((_, item) => item !== index))}
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
      <button
        className="button ghost"
        onClick={() => setAdmins((current) => [...current, { steamId: "", flags: roles.full }])}
      >
        <Plus size={15} />
        {t("addAdmin")}
      </button>
      <label className="fleet-check">
        <input type="checkbox" checked={fleet} onChange={(event) => setFleet(event.target.checked)} />{" "}
        {t("fleetAdmins")}
      </label>
      <footer className="management-actions">
        <button className="button ghost" onClick={reset}>
          {t("resetEnv")}
        </button>
        <button className="button primary" onClick={save}>
          {t("saveReload")}
        </button>
      </footer>
    </section>
  );
}
