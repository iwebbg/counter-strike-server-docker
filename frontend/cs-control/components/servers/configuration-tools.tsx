"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Copy, Download, FileClock, FileUp, KeyRound, Layers3, RotateCcw, Save, Trash2 } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";

type ConfigurationDocument = {
  schemaVersion: 1;
  exportedAt?: string;
  configuration: Record<string, unknown>;
};

type Template = {
  id: string;
  name: string;
  description: string;
  configuration: { mode: string; maxPlayers: number; startMap: string };
};

type DeployResult = { serverId: string; rconPassword: string; started: boolean };
type Revision = {
  id: string;
  revision: number;
  reason: string;
  actorName?: string;
  createdAt: string;
  configuration: Record<string, unknown>;
};
type View = "templates" | "history" | "save" | "clone" | "import" | null;

export function ConfigurationTools({
  serverId,
  serverName,
  onChanged,
}: {
  serverId: string;
  serverName: string;
  onChanged: (serverId: string) => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [view, setView] = useState<View>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [selectedRevision, setSelectedRevision] = useState<Revision | null>(null);
  const [document, setDocument] = useState<ConfigurationDocument | null>(null);
  const [pending, setPending] = useState(false);
  const [rotatedRcon, setRotatedRcon] = useState<{ password: string; serverId: string } | null>(null);

  const loadTemplates = useCallback(async () => {
    const result = await api<{ templates: Template[] }>("/configuration-templates");
    setTemplates(result.templates);
  }, []);

  useEffect(() => {
    if (view !== "templates") return;
    loadTemplates().catch((error) => toast.error(error instanceof Error ? error.message : "REQUEST_FAILED"));
  }, [loadTemplates, toast, view]);

  useEffect(() => {
    if (view !== "history") return;
    api<{ revisions: Revision[] }>(`/servers/${serverId}/configuration-history`)
      .then((result) => {
        setRevisions(result.revisions);
        setSelectedRevision(result.revisions[0] || null);
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : "REQUEST_FAILED"));
  }, [serverId, toast, view]);

  async function exportJson() {
    try {
      const exported = await api<ConfigurationDocument>(`/servers/${serverId}/configuration/export`);
      const url = URL.createObjectURL(new Blob([JSON.stringify(exported, null, 2)], { type: "application/json" }));
      const link = window.document.createElement("a");
      link.href = url;
      link.download = `${serverName.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "cs16-server"}.json`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(t("configurationExported"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "REQUEST_FAILED");
    }
  }

  async function saveTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    try {
      await api(`/servers/${serverId}/configuration-templates`, {
        method: "POST",
        body: JSON.stringify({ name: form.get("name"), description: form.get("description") }),
      });
      toast.success(t("templateSaved"));
      setView(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "REQUEST_FAILED");
    } finally {
      setPending(false);
    }
  }

  async function deploy(path: string, event: FormEvent<HTMLFormElement>, imported?: ConfigurationDocument) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    try {
      const result = await api<DeployResult>(path, {
        method: "POST",
        body: JSON.stringify({
          ...(imported ? { document: imported } : {}),
          name: form.get("name"),
          port: form.get("port") ? Number(form.get("port")) : null,
          startImmediately: form.get("startImmediately") === "on",
        }),
      });
      toast.success(`${t("serverCreatedFromConfiguration")} RCON: ${result.rconPassword}`);
      setView(null);
      onChanged(result.serverId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "REQUEST_FAILED");
    } finally {
      setPending(false);
    }
  }

  async function applyTemplate(templateId: string) {
    setPending(true);
    try {
      const result = await api<{ serverId: string }>(
        `/servers/${serverId}/configuration-templates/${templateId}/apply`,
        { method: "POST", body: "{}" },
      );
      toast.success(t("templateApplied"));
      setView(null);
      onChanged(result.serverId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "REQUEST_FAILED");
    } finally {
      setPending(false);
    }
  }

  async function removeTemplate(templateId: string) {
    setPending(true);
    try {
      await api(`/configuration-templates/${templateId}`, { method: "DELETE" });
      await loadTemplates();
      toast.success(t("templateDeleted"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "REQUEST_FAILED");
    } finally {
      setPending(false);
    }
  }

  async function rollback(revision: number) {
    setPending(true);
    try {
      const result = await api<{ serverId: string }>(
        `/servers/${serverId}/configuration-history/${revision}/rollback`,
        { method: "POST", body: "{}" },
      );
      toast.success(t("configurationRolledBack"));
      setView(null);
      onChanged(result.serverId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "REQUEST_FAILED");
    } finally {
      setPending(false);
    }
  }

  async function rotateRcon() {
    setPending(true);
    try {
      const result = await api<{ serverId: string; rconPassword: string }>(`/servers/${serverId}/rcon/rotate`, {
        method: "POST",
        body: "{}",
      });
      setRotatedRcon({ password: result.rconPassword, serverId: result.serverId });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "REQUEST_FAILED");
    } finally {
      setPending(false);
    }
  }

  const latest = revisions[0]?.configuration;
  const differences = selectedRevision
    ? Object.keys({ ...latest, ...selectedRevision.configuration })
        .filter((key) => JSON.stringify(latest?.[key]) !== JSON.stringify(selectedRevision.configuration[key]))
        .sort()
    : [];

  return (
    <>
      <div className="configuration-tools">
        <button className="button ghost" type="button" onClick={() => setView("templates")}>
          <Layers3 size={15} /> {t("templates")}
        </button>
        <button className="button ghost" type="button" onClick={() => setView("save")}>
          <Save size={15} /> {t("saveTemplate")}
        </button>
        <button className="button ghost" type="button" onClick={() => setView("history")}>
          <FileClock size={15} /> {t("configurationHistory")}
        </button>
        <button className="button ghost" type="button" onClick={exportJson}>
          <Download size={15} /> {t("exportConfiguration")}
        </button>
        <button className="button ghost" type="button" onClick={() => setView("import")}>
          <FileUp size={15} /> {t("importConfiguration")}
        </button>
        <button className="button ghost" type="button" onClick={() => setView("clone")}>
          <Copy size={15} /> {t("cloneServer")}
        </button>
        <button className="button ghost" type="button" disabled={pending} onClick={rotateRcon}>
          <KeyRound size={15} /> {t("rotateRcon")}
        </button>
      </div>

      <Modal
        open={Boolean(rotatedRcon)}
        onOpenChange={(open) => {
          if (open || !rotatedRcon) return;
          const nextServerId = rotatedRcon.serverId;
          setRotatedRcon(null);
          onChanged(nextServerId);
        }}
        title={t("newRconPassword")}
        eyebrow="SHOW ONCE"
      >
        <div className="one-time-secret">
          <p>{t("copyRconNow")}</p>
          <code>{rotatedRcon?.password}</code>
          <button
            className="button primary"
            onClick={() => rotatedRcon && navigator.clipboard.writeText(rotatedRcon.password)}
          >
            {t("copyPassword")}
          </button>
        </div>
      </Modal>

      <Modal
        open={view === "templates"}
        onOpenChange={(open) => !open && setView(null)}
        title={t("configurationTemplates")}
        eyebrow="CONFIGURATION LIBRARY"
        wide
      >
        <div className="configuration-template-list">
          {templates.map((template) => (
            <article key={template.id}>
              <div>
                <strong>{template.name}</strong>
                <span>{template.description || t("noDescription")}</span>
                <small>
                  {template.configuration.mode} · {template.configuration.maxPlayers} ·{" "}
                  {template.configuration.startMap}
                </small>
              </div>
              <div>
                <button className="button primary" disabled={pending} onClick={() => applyTemplate(template.id)}>
                  {t("applyTemplate")}
                </button>
                <button className="button danger" disabled={pending} onClick={() => removeTemplate(template.id)}>
                  <Trash2 size={14} /> {t("delete")}
                </button>
              </div>
            </article>
          ))}
          {!templates.length && <p className="empty-copy">{t("noTemplates")}</p>}
        </div>
      </Modal>

      <Modal
        open={view === "history"}
        onOpenChange={(open) => !open && setView(null)}
        title={t("configurationHistory")}
        eyebrow="VERSIONED CONFIGURATION"
        wide
      >
        <div className="configuration-history">
          <div className="configuration-revisions">
            {revisions.map((revision) => (
              <button
                type="button"
                className={selectedRevision?.id === revision.id ? "selected" : ""}
                key={revision.id}
                onClick={() => setSelectedRevision(revision)}
              >
                <strong>#{revision.revision}</strong>
                <span>{revision.reason}</span>
                <small>
                  {revision.actorName || t("system")} · {new Date(revision.createdAt).toLocaleString()}
                </small>
              </button>
            ))}
            {!revisions.length && <p className="empty-copy">{t("noConfigurationHistory")}</p>}
          </div>
          {selectedRevision && (
            <div className="configuration-diff">
              <h3>{t("changesAgainstLatest")}</h3>
              {differences.map((key) => (
                <article key={key}>
                  <strong>{key}</strong>
                  <code>- {JSON.stringify(selectedRevision.configuration[key])}</code>
                  <code>+ {JSON.stringify(latest?.[key])}</code>
                </article>
              ))}
              {!differences.length && <p className="empty-copy">{t("sameAsLatest")}</p>}
              {selectedRevision !== revisions[0] && (
                <button
                  className="button primary"
                  disabled={pending}
                  onClick={() => rollback(selectedRevision.revision)}
                >
                  <RotateCcw size={15} /> {t("rollbackToRevision", { revision: selectedRevision.revision })}
                </button>
              )}
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={view === "save"}
        onOpenChange={(open) => !open && setView(null)}
        title={t("saveTemplate")}
        eyebrow="CAPTURE CONFIGURATION"
      >
        <form className="form-grid" onSubmit={saveTemplate}>
          <label className="full">
            <span>{t("templateName")}</span>
            <input name="name" minLength={2} maxLength={96} required />
          </label>
          <label className="full">
            <span>{t("description")}</span>
            <textarea name="description" maxLength={255} />
          </label>
          <footer className="form-actions full">
            <button type="button" className="button ghost" onClick={() => setView(null)}>
              {t("cancel")}
            </button>
            <button className="button primary" disabled={pending}>
              {t("saveTemplate")}
            </button>
          </footer>
        </form>
      </Modal>

      <Modal
        open={view === "clone"}
        onOpenChange={(open) => !open && setView(null)}
        title={t("cloneServer")}
        eyebrow="CLONE INSTANCE"
      >
        <DeployForm
          defaultName={`${serverName} Clone`}
          pending={pending}
          onCancel={() => setView(null)}
          onSubmit={(event) => deploy(`/servers/${serverId}/clone`, event)}
        />
      </Modal>

      <Modal
        open={view === "import"}
        onOpenChange={(open) => !open && setView(null)}
        title={t("importConfiguration")}
        eyebrow="VALIDATED JSON IMPORT"
      >
        <form className="form-grid" onSubmit={(event) => document && deploy("/servers/import", event, document)}>
          <label className="full">
            <span>{t("configurationFile")}</span>
            <input
              type="file"
              accept="application/json,.json"
              required
              onChange={async (event) => {
                const file = event.target.files?.[0];
                try {
                  setDocument(file ? JSON.parse(await file.text()) : null);
                } catch {
                  setDocument(null);
                  toast.error(t("invalidConfigurationFile"));
                }
              }}
            />
          </label>
          <DeployFields defaultName="Imported CS 1.6 Server" />
          <footer className="form-actions full">
            <button type="button" className="button ghost" onClick={() => setView(null)}>
              {t("cancel")}
            </button>
            <button className="button primary" disabled={pending || !document}>
              {t("importConfiguration")}
            </button>
          </footer>
        </form>
      </Modal>
    </>
  );
}

function DeployFields({ defaultName }: { defaultName: string }) {
  const { t } = useI18n();
  return (
    <>
      <label>
        <span>{t("serverName")}</span>
        <input name="name" defaultValue={defaultName} minLength={2} maxLength={48} required />
      </label>
      <label>
        <span>{t("hostPort")}</span>
        <input name="port" inputMode="numeric" placeholder={t("automatic")} />
      </label>
      <label className="checkbox full">
        <input name="startImmediately" type="checkbox" defaultChecked />
        <span>{t("startImmediately")}</span>
      </label>
    </>
  );
}

function DeployForm({
  defaultName,
  pending,
  onCancel,
  onSubmit,
}: {
  defaultName: string;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const { t } = useI18n();
  return (
    <form className="form-grid" onSubmit={onSubmit}>
      <DeployFields defaultName={defaultName} />
      <footer className="form-actions full">
        <button type="button" className="button ghost" onClick={onCancel}>
          {t("cancel")}
        </button>
        <button className="button primary" disabled={pending}>
          {t("cloneServer")}
        </button>
      </footer>
    </form>
  );
}
