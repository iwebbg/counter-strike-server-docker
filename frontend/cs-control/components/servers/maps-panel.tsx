"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/components/i18n-provider";
import { api } from "@/lib/api";

type MapsPayload = { available: string[]; selected: string[]; current: string; mode: string; source: string };

export function MapsPanel({ serverId, canManage }: { serverId: string; canManage: boolean }) {
  const toast = useToast();
  const { t } = useI18n();
  const [data, setData] = useState<MapsPayload | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const load = useCallback(async () => {
    try {
      const result = await api<MapsPayload>(`/servers/${serverId}/maps`);
      setData(result);
      setSelected(result.selected);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "REQUEST_FAILED");
    }
  }, [serverId, toast]);
  useEffect(() => {
    load();
  }, [load]);
  const save = async () => {
    if (!selected.length) return;
    try {
      await api(`/servers/${serverId}/maps`, { method: "PUT", body: JSON.stringify({ maps: selected }) });
      toast.success(`${selected.length} maps saved`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "REQUEST_FAILED");
    }
  };
  const play = async (map: string) => {
    if (!confirm(`Change the running map to ${map}?`)) return;
    try {
      await api(`/servers/${serverId}/maps/change`, { method: "POST", body: JSON.stringify({ map }) });
      toast.success(`Changing map to ${map}`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "REQUEST_FAILED");
    }
  };
  return (
    <section className="management-panel">
      <header>
        <div>
          <p className="eyebrow">LIVE MAP CONTROL</p>
          <h2>{t("mapRotation")}</h2>
        </div>
        <div className="badges">
          <span>{data?.mode || "—"}</span>
          <span>{data?.source || "—"}</span>
        </div>
      </header>
      <div className="management-toolbar">
        <input placeholder={t("filterMaps")} value={query} onChange={(event) => setQuery(event.target.value)} />
        {canManage && (
          <>
            <button onClick={() => setSelected(data?.available || [])}>{t("selectAll")}</button>
            <button onClick={() => setSelected([])}>{t("clear")}</button>
          </>
        )}
      </div>
      <div className="map-management-grid">
        {data?.available
          .filter((map) => map.toLowerCase().includes(query.toLowerCase()))
          .map((map) => (
            <div key={map}>
              <label>
                <input
                  disabled={!canManage}
                  type="checkbox"
                  checked={selected.includes(map)}
                  onChange={(event) =>
                    setSelected((current) =>
                      event.target.checked ? [...current, map] : current.filter((item) => item !== map),
                    )
                  }
                />
                <code>{map}</code>
                {data.current === map && <small>NOW PLAYING</small>}
              </label>
              {canManage && data.current !== map && <button onClick={() => play(map)}>{t("playNow")}</button>}
            </div>
          ))}
      </div>
      {canManage && (
        <footer className="management-actions">
          <button className="button primary" disabled={!selected.length} onClick={save}>
            {t("saveRotation")}
          </button>
        </footer>
      )}
    </section>
  );
}
