"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/components/i18n-provider";
import { api } from "@/lib/api";

type Configuration = {
  name: string;
  mode: "classic" | "gungame";
  maxPlayers: number;
  startMap: string;
  maps: string[];
  port: number;
  hasRconPassword: boolean;
  hasServerPassword: boolean;
  running: boolean;
  volumes: string[];
  welcomeMessage: string;
  warmupEnabled: boolean;
  warmupSeconds: number;
  spawnProtectionEnabled: boolean;
  spawnProtectionSeconds: number;
  semiclipEnabled: boolean;
  doubleJumpEnabled: boolean;
  doubleJumpVelocity: number;
  afkEnabled: boolean;
  rtvEnabled: boolean;
  killstreakEnabled: boolean;
  killstreakSoundsEnabled: boolean;
  killstreakHudEnabled: boolean;
};
type UpdateResult = { id: string; serverId: string };
const modeMaps = {
  classic: [
    "de_dust2",
    "de_inferno",
    "de_nuke",
    "de_train",
    "cs_office",
    "de_csgothic",
    "de_mini_train2",
    "de_nuke_fora",
    "de_solitude",
  ],
  gungame: [
    "gg_3way",
    "gg_aztec_VS_dust",
    "gg_buzz",
    "gg_fy_deagle_dustworld",
    "gg_fy_deagle_dustworld3",
    "gg_hideout",
    "gg_inferno",
    "gg_js_cbble",
    "gg_mariocastle_mt",
    "gg_mini_dust2",
    "gg_mini_skilluj",
    "gg_os_arena",
  ],
};
export function ConfigurationPanel({
  serverId,
  onUpdated,
}: {
  serverId: string;
  onUpdated: (nextServerId: string) => Promise<void> | void;
}) {
  const toast = useToast();
  const { t } = useI18n();
  const [data, setData] = useState<Configuration | null>(null);
  const [pending, setPending] = useState(false);
  const load = useCallback(async () => {
    try {
      setData(await api<Configuration>(`/servers/${serverId}/configuration`));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "REQUEST_FAILED");
    }
  }, [serverId, toast]);
  useEffect(() => {
    load();
  }, [load]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data) return;
    const form = new FormData(event.currentTarget);
    setPending(true);
    try {
      const updated = await api<UpdateResult>(`/servers/${serverId}`, {
        method: "PUT",
        body: JSON.stringify({
          name: form.get("name"),
          mode: data.mode,
          maxPlayers: Number(form.get("maxPlayers")),
          startMap: data.startMap,
          maps: data.maps,
          port: Number(form.get("port")),
          serverPassword: form.get("serverPassword") || "",
          rconPassword: form.get("rconPassword") || "",
          clearServerPassword: form.get("clearServerPassword") === "on",
          welcomeMessage: data.welcomeMessage,
          warmupEnabled: data.warmupEnabled,
          warmupSeconds: data.warmupSeconds,
          spawnProtectionEnabled: data.spawnProtectionEnabled,
          spawnProtectionSeconds: data.spawnProtectionSeconds,
          semiclipEnabled: data.semiclipEnabled,
          doubleJumpEnabled: data.doubleJumpEnabled,
          doubleJumpVelocity: data.doubleJumpVelocity,
          afkEnabled: data.afkEnabled,
          rtvEnabled: data.rtvEnabled,
          killstreakEnabled: data.killstreakEnabled,
          killstreakSoundsEnabled: data.killstreakSoundsEnabled,
          killstreakHudEnabled: data.killstreakHudEnabled,
        }),
      });
      toast.success(t("serverSaved"));
      await onUpdated(updated.serverId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "REQUEST_FAILED");
    } finally {
      setPending(false);
    }
  }
  if (!data) return <p className="empty-copy">{t("loadingConfiguration")}</p>;
  return (
    <section className="management-panel">
      <header>
        <div>
          <p className="eyebrow">{t("instanceConfiguration")}</p>
          <h2>{t("editServer")}</h2>
        </div>
      </header>
      <form className="form-grid configuration-form" onSubmit={submit}>
        <label className="full">
          <span>{t("serverName")}</span>
          <input name="name" value={data.name} onChange={(event) => setData({ ...data, name: event.target.value })} />
        </label>
        <label>
          <span>{t("gameMode")}</span>
          <select
            value={data.mode}
            onChange={(event) => {
              const mode = event.target.value as Configuration["mode"];
              setData({ ...data, mode, maps: modeMaps[mode], startMap: modeMaps[mode][0] });
            }}
          >
            <option value="classic">Classic</option>
            <option value="gungame">GunGame</option>
          </select>
        </label>
        <label>
          <span>{t("maxPlayers")}</span>
          <input
            name="maxPlayers"
            type="number"
            min={2}
            max={32}
            value={data.maxPlayers}
            onChange={(event) => setData({ ...data, maxPlayers: Number(event.target.value) })}
          />
        </label>
        <label>
          <span>{t("hostPort")}</span>
          <input
            name="port"
            type="number"
            value={data.port}
            onChange={(event) => setData({ ...data, port: Number(event.target.value) })}
          />
        </label>
        <label>
          <span>{t("startMap")}</span>
          <select value={data.startMap} onChange={(event) => setData({ ...data, startMap: event.target.value })}>
            {data.maps.map((map) => (
              <option key={map}>{map}</option>
            ))}
          </select>
        </label>
        <h3 className="configuration-section-title full">{t("gameplaySettings")}</h3>
        <label className="full">
          <span>{t("welcomeMessage")}</span>
          <input
            value={data.welcomeMessage}
            maxLength={160}
            onChange={(event) => setData({ ...data, welcomeMessage: event.target.value })}
          />
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={data.warmupEnabled}
            onChange={(event) => setData({ ...data, warmupEnabled: event.target.checked })}
          />
          <span>{t("warmup")}</span>
        </label>
        <label>
          <span>{t("warmupDuration")}</span>
          <input
            type="number"
            min={0}
            max={600}
            value={data.warmupSeconds}
            onChange={(event) => setData({ ...data, warmupSeconds: Number(event.target.value) })}
          />
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={data.spawnProtectionEnabled}
            onChange={(event) => setData({ ...data, spawnProtectionEnabled: event.target.checked })}
          />
          <span>{t("spawnProtection")}</span>
        </label>
        <label>
          <span>{t("spawnProtectionDuration")}</span>
          <input
            type="number"
            min={0}
            max={30}
            step="0.5"
            value={data.spawnProtectionSeconds}
            onChange={(event) => setData({ ...data, spawnProtectionSeconds: Number(event.target.value) })}
          />
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={data.semiclipEnabled}
            onChange={(event) => setData({ ...data, semiclipEnabled: event.target.checked })}
          />
          <span>{t("semiclip")}</span>
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={data.afkEnabled}
            onChange={(event) => setData({ ...data, afkEnabled: event.target.checked })}
          />
          <span>{t("afkManager")}</span>
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={data.rtvEnabled}
            onChange={(event) => setData({ ...data, rtvEnabled: event.target.checked })}
          />
          <span>{t("rtvMapVotes")}</span>
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={data.doubleJumpEnabled}
            onChange={(event) => setData({ ...data, doubleJumpEnabled: event.target.checked })}
          />
          <span>{t("doubleJump")}</span>
        </label>
        <label>
          <span>{t("doubleJumpVelocity")}</span>
          <input
            type="number"
            min={100}
            max={1000}
            value={data.doubleJumpVelocity}
            onChange={(event) => setData({ ...data, doubleJumpVelocity: Number(event.target.value) })}
          />
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={data.killstreakEnabled}
            onChange={(event) => setData({ ...data, killstreakEnabled: event.target.checked })}
          />
          <span>{t("killstreakAnnouncements")}</span>
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={data.killstreakSoundsEnabled}
            onChange={(event) => setData({ ...data, killstreakSoundsEnabled: event.target.checked })}
          />
          <span>{t("killstreakSounds")}</span>
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={data.killstreakHudEnabled}
            onChange={(event) => setData({ ...data, killstreakHudEnabled: event.target.checked })}
          />
          <span>{t("killstreakHud")}</span>
        </label>
        <h3 className="configuration-section-title full">{t("accessSettings")}</h3>
        <label className="full">
          <span>{t("serverPassword")}</span>
          <input
            name="serverPassword"
            type="password"
            placeholder={data.hasServerPassword ? t("leaveBlankPreserve") : t("noPasswordConfigured")}
          />
        </label>
        <label className="checkbox full">
          <input name="clearServerPassword" type="checkbox" />
          <span>{t("removeServerPassword")}</span>
        </label>
        <label className="full">
          <span>{t("rconPassword")}</span>
          <input
            name="rconPassword"
            type="password"
            placeholder={data.hasRconPassword ? t("leaveBlankPreserve") : t("setSecurePassword")}
          />
        </label>
        <div className="volume-note full">Persistent volumes: {data.volumes.join(", ")}</div>
        <footer className="form-actions full">
          <button className="button primary" disabled={pending}>
            {pending ? t("loading") : t("saveRecreate")}
          </button>
        </footer>
      </form>
    </section>
  );
}
