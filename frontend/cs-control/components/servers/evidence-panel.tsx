"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Radio, Square } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";

type EvidenceState = {
  recording: boolean;
  filename: string | null;
  recordings: Array<{ filename: string; size: number; modifiedAt: string }>;
};

function readableSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function EvidencePanel({ serverId }: { serverId: string }) {
  const { t } = useI18n();
  const toast = useToast();
  const [state, setState] = useState<EvidenceState | null>(null);
  const [pending, setPending] = useState(false);
  const load = useCallback(async () => {
    try {
      setState(await api<EvidenceState>(`/servers/${serverId}/evidence`));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("requestFailed"));
    }
  }, [serverId, t, toast]);
  useEffect(() => {
    load();
  }, [load]);
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
  return (
    <section className="management-panel">
      <header>
        <div>
          <p className="eyebrow">{t("hltvEvidence")}</p>
          <h2>{t("demoEvidence")}</h2>
          <p>{t("evidenceDescription")}</p>
        </div>
        <button className={`button ${state?.recording ? "danger" : "primary"}`} disabled={pending} onClick={toggle}>
          {state?.recording ? <Square size={15} /> : <Radio size={15} />}
          {t(state?.recording ? "stopRecording" : "startRecording")}
        </button>
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
    </section>
  );
}
