"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Download, Flag, Radio, Square, Trash2 } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";

type Recording = { filename: string; size: number; modifiedAt: string };
type EvidenceState = {
  recording: boolean;
  filename: string | null;
  startedAt: string | null;
  recordings: Recording[];
};
type Marker = {
  id: string;
  filename: string;
  steamId: string;
  playerName: string;
  reason: string;
  offsetSeconds: number | null;
  operatorName: string | null;
  createdAt: string;
};
type Player = { userId: number; name: string; steamId: string };

function readableSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function readableOffset(seconds: number | null) {
  if (seconds === null) return "—";
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

export function EvidencePanel({ serverId }: { serverId: string }) {
  const { t } = useI18n();
  const toast = useToast();
  const [state, setState] = useState<EvidenceState | null>(null);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [pending, setPending] = useState(false);
  const [markerOpen, setMarkerOpen] = useState(false);
  const [deleting, setDeleting] = useState<Marker | null>(null);
  const [steamId, setSteamId] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [reason, setReason] = useState("");
  const [target, setTarget] = useState("current");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const load = useCallback(async () => {
    try {
      const [nextState, markerData] = await Promise.all([
        api<EvidenceState>(`/servers/${serverId}/evidence`),
        api<{ markers: Marker[] }>(`/servers/${serverId}/evidence/markers`),
      ]);
      setState(nextState);
      setMarkers(markerData.markers);
      setPage((current) => Math.min(current, Math.max(1, Math.ceil(markerData.markers.length / pageSize))));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("requestFailed"));
    }
  }, [serverId, t, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const visibleMarkers = useMemo(() => markers.slice((page - 1) * pageSize, page * pageSize), [markers, page]);

  async function toggle() {
    setPending(true);
    try {
      await api(`/servers/${serverId}/evidence/${state?.recording ? "stop" : "start"}`, { method: "POST" });
      toast.success(t(state?.recording ? "evidenceStopped" : "evidenceStarted"));
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("requestFailed"));
    } finally {
      setPending(false);
    }
  }

  async function openMarker() {
    setSteamId("");
    setPlayerName("");
    setReason("");
    setTarget(state?.recording ? "current" : state?.recordings[0]?.filename || "");
    try {
      setPlayers((await api<{ players: Player[] }>(`/servers/${serverId}/players`)).players);
    } catch {
      setPlayers([]);
    }
    setMarkerOpen(true);
  }

  function selectPlayer(value: string) {
    const player = players.find((item) => item.steamId === value);
    setSteamId(value);
    if (player) setPlayerName(player.name);
  }

  async function createMarker(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      await api(`/servers/${serverId}/evidence/markers`, {
        method: "POST",
        body: JSON.stringify({
          steamId,
          playerName,
          reason,
          ...(target && target !== "current" ? { filename: target } : {}),
        }),
      });
      toast.success(t("evidenceMarkerCreated"));
      setMarkerOpen(false);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("requestFailed"));
    } finally {
      setPending(false);
    }
  }

  async function removeMarker() {
    if (!deleting) return;
    setPending(true);
    try {
      await api(`/servers/${serverId}/evidence/markers/${deleting.id}`, { method: "DELETE" });
      toast.success(t("evidenceMarkerDeleted"));
      setDeleting(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("requestFailed"));
    } finally {
      setPending(false);
    }
  }

  const canMark = Boolean(state?.recording || state?.recordings.length);
  return (
    <section className="management-panel">
      <header>
        <div>
          <p className="eyebrow">{t("hltvEvidence")}</p>
          <h2>{t("demoEvidence")}</h2>
          <p>{t("evidenceDescription")}</p>
        </div>
        <div className="header-actions">
          <button className="button ghost" disabled={!canMark || pending} onClick={openMarker}>
            <Flag size={15} /> {t("markEvidence")}
          </button>
          <button className={`button ${state?.recording ? "danger" : "primary"}`} disabled={pending} onClick={toggle}>
            {state?.recording ? <Square size={15} /> : <Radio size={15} />}
            {t(state?.recording ? "stopRecording" : "startRecording")}
          </button>
        </div>
      </header>
      {state?.recording && (
        <p className="success-text">
          {t("recordingNow")}: {state.filename}
        </p>
      )}
      <div className="table-panel">
        <div className="table-head evidence-row">
          <span>{t("file")}</span>
          <span>{t("size")}</span>
          <span>{t("time")}</span>
          <span>{t("actions")}</span>
        </div>
        {state?.recordings.map((recording) => (
          <div className="table-row evidence-row" key={recording.filename}>
            <strong>{recording.filename}</strong>
            <span>{readableSize(recording.size)}</span>
            <span>{new Date(recording.modifiedAt).toLocaleString()}</span>
            <a
              className="button ghost"
              href={`/api/servers/${serverId}/evidence/${encodeURIComponent(recording.filename)}`}
            >
              <Download size={14} /> {t("download")}
            </a>
          </div>
        ))}
        {state && !state.recordings.length && <p className="empty-copy">{t("noEvidence")}</p>}
      </div>

      <header className="subsection-header">
        <div>
          <p className="eyebrow">{t("evidenceMarkers")}</p>
          <h2>{t("suspiciousPlayerMarkers")}</h2>
        </div>
      </header>
      <div className="table-panel">
        <div className="table-head evidence-marker-row">
          <span>{t("player")}</span>
          <span>{t("reason")}</span>
          <span>{t("recording")}</span>
          <span>{t("operator")}</span>
          <span />
        </div>
        {visibleMarkers.map((marker) => (
          <div className="table-row evidence-marker-row" key={marker.id}>
            <div>
              <strong>{marker.playerName}</strong>
              <small>{marker.steamId}</small>
            </div>
            <span>{marker.reason}</span>
            <div>
              <strong>{marker.filename}</strong>
              <small>
                {t("offset")}: {readableOffset(marker.offsetSeconds)}
              </small>
            </div>
            <div>
              <strong>{marker.operatorName || "—"}</strong>
              <small>{new Date(marker.createdAt).toLocaleString()}</small>
            </div>
            <button className="icon-button danger-action" onClick={() => setDeleting(marker)} aria-label={t("delete")}>
              <Trash2 size={15} />
            </button>
          </div>
        ))}
        {!markers.length && <p className="empty-copy">{t("noEvidenceMarkers")}</p>}
        <Pagination page={page} pageSize={pageSize} totalItems={markers.length} onPageChange={setPage} />
      </div>

      <Modal open={markerOpen} onOpenChange={setMarkerOpen} title={t("markEvidence")} eyebrow={t("evidenceMarkers")}>
        <form className="form-grid" onSubmit={createMarker}>
          {players.length > 0 && (
            <label className="full">
              <span>{t("connectedPlayer")}</span>
              <select value={steamId} onChange={(event) => selectPlayer(event.target.value)}>
                <option value="">{t("selectPlayer")}</option>
                {players.map((player) => (
                  <option value={player.steamId} key={player.userId}>
                    {player.name} — {player.steamId}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            <span>Steam ID</span>
            <input
              required
              pattern="STEAM_[0-9]+:[01]:[0-9]+"
              value={steamId}
              onChange={(event) => setSteamId(event.target.value)}
            />
          </label>
          <label>
            <span>{t("playerName")}</span>
            <input required maxLength={64} value={playerName} onChange={(event) => setPlayerName(event.target.value)} />
          </label>
          <label className="full">
            <span>{t("recording")}</span>
            <select required value={target} onChange={(event) => setTarget(event.target.value)}>
              {state?.recording && <option value="current">{t("currentRecording")}</option>}
              {state?.recordings.map((recording) => (
                <option value={recording.filename} key={recording.filename}>
                  {recording.filename}
                </option>
              ))}
            </select>
          </label>
          <label className="full">
            <span>{t("reason")}</span>
            <textarea
              required
              minLength={3}
              maxLength={255}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <footer className="form-actions full">
            <button type="button" className="button ghost" onClick={() => setMarkerOpen(false)}>
              {t("cancel")}
            </button>
            <button className="button primary" disabled={pending}>
              {t("saveMarker")}
            </button>
          </footer>
        </form>
      </Modal>
      <ConfirmModal
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t("deleteEvidenceMarker")}
        description={t("deleteEvidenceMarkerDescription")}
        confirmLabel={t("delete")}
        pending={pending}
        onConfirm={removeMarker}
      />
    </section>
  );
}
