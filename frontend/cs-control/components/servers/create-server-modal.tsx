"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/components/i18n-provider";
import { api } from "@/lib/api";

const pools = {
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

export function CreateServerModal({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const toast = useToast();
  const { t } = useI18n();
  const [mode, setMode] = useState<"classic" | "gungame">("classic");
  const [selected, setSelected] = useState<string[]>(pools.classic);
  const [pending, setPending] = useState(false);
  const maps = useMemo(() => pools[mode], [mode]);
  const changeMode = (next: "classic" | "gungame") => {
    setMode(next);
    setSelected(pools[next]);
  };
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected.length) return;
    const form = new FormData(event.currentTarget);
    setPending(true);
    try {
      const result = await api<{ rconPassword?: string }>("/servers", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          mode,
          maxPlayers: Number(form.get("maxPlayers")),
          startMap: form.get("startMap"),
          maps: selected,
          port: form.get("port") || null,
          serverPassword: form.get("serverPassword") || "",
          rconPassword: form.get("rconPassword") || "",
          adminSteamIds: form.get("adminSteamIds") || "",
          startImmediately: form.get("startImmediately") === "on",
        }),
      });
      toast.success(result.rconPassword ? `Server created. RCON: ${result.rconPassword}` : "Server created");
      onOpenChange(false);
      onCreated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "REQUEST_FAILED");
    } finally {
      setPending(false);
    }
  }
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={t("newCsServer")} eyebrow="DEPLOY INSTANCE" wide>
      <form className="form-grid" onSubmit={submit}>
        <label className="full">
          <span>{t("serverName")}</span>
          <input name="name" defaultValue="Friday Night Arena" minLength={2} maxLength={48} required />
        </label>
        <fieldset className="mode-select full">
          <legend>{t("gameMode")}</legend>
          <button type="button" className={mode === "classic" ? "selected" : ""} onClick={() => changeMode("classic")}>
            <b>Classic</b>
            <small>Competitive CS 1.6</small>
          </button>
          <button type="button" className={mode === "gungame" ? "selected" : ""} onClick={() => changeMode("gungame")}>
            <b>GunGame</b>
            <small>Progressive weapons</small>
          </button>
        </fieldset>
        <label>
          <span>{t("maxPlayers")}</span>
          <input name="maxPlayers" type="number" min={2} max={32} defaultValue={24} />
        </label>
        <label>
          <span>{t("startMap")}</span>
          <select name="startMap">
            {selected.map((map) => (
              <option key={map}>{map}</option>
            ))}
          </select>
        </label>
        <fieldset className="map-picker full">
          <legend>Rotation · {mode}</legend>
          {maps.map((map) => (
            <label key={map}>
              <input
                type="checkbox"
                checked={selected.includes(map)}
                onChange={(e) =>
                  setSelected((current) =>
                    e.target.checked ? [...current, map] : current.filter((item) => item !== map),
                  )
                }
              />
              <code>{map}</code>
            </label>
          ))}
        </fieldset>
        <label>
          <span>{t("hostPort")}</span>
          <input name="port" inputMode="numeric" placeholder="Automatic" />
        </label>
        <label>
          <span>{t("serverPassword")}</span>
          <input name="serverPassword" type="password" />
        </label>
        <label className="full">
          <span>{t("rconPassword")}</span>
          <input name="rconPassword" type="password" placeholder="Securely generated when blank" />
        </label>
        <label className="full">
          <span>{t("fullAdmins")}</span>
          <input name="adminSteamIds" placeholder="STEAM_0:1:123456" />
        </label>
        <label className="checkbox full">
          <input name="startImmediately" type="checkbox" defaultChecked />
          <span>{t("startImmediately")}</span>
        </label>
        <footer className="form-actions full">
          <button type="button" className="button ghost" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </button>
          <button className="button primary" disabled={pending || !selected.length}>
            {pending ? t("loading") : t("createServer")}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
