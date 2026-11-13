"use client";

import { useEffect, useState, type FormEvent } from "react";
import { CircleHelp, Clipboard, ExternalLink, FileCog, Github, HeartHandshake, Mail } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { useSession } from "@/components/session-provider";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";

const repositoryUrl = "https://github.com/iwebbg/counter-strike-server-docker";
const issueUrl = `${repositoryUrl}/issues/new`;
const supportEmail = "office@interweb.bg";
const diagnosticsCommand =
  "./docker/compose doctor && ./docker/compose ps && ./docker/compose logs --tail=200 panel panel-web panel-proxy server mariadb redis";

const donationOptions = [
  {
    name: "Ko-fi",
    descriptionKey: "supportWithCoffee" as const,
    href: "https://ko-fi.com/interwebltd",
    mark: "☕",
  },
  {
    name: "Buy Me a Coffee",
    descriptionKey: "oneTimeSupport" as const,
    href: "https://buymeacoffee.com/interweb.bg",
    mark: "☕",
  },
  {
    name: "PayPal",
    descriptionKey: "supportViaPaypal" as const,
    href: "https://paypal.me/interwebltd",
    mark: "P",
  },
];

type DeploymentConfiguration = {
  readOnly: boolean;
  allowlist: string[];
  current: Record<string, string>;
};

type DeploymentPreview = {
  readOnly: boolean;
  valid: boolean;
  warnings: string[];
  dotenv: string;
};

const deploymentFields = [
  "SERVER_MODE",
  "SERVER_NAME",
  "MAX_PLAYERS",
  "PORT_RANGE_START",
  "PORT_RANGE_END",
  "PANEL_ALLOWED_NETWORKS",
  "PANEL_DOMAIN",
  "PANEL_HTTPS_PORT",
] as const;

export default function SupportPage() {
  const { t } = useI18n();
  const { user } = useSession();
  const toast = useToast();
  const [deployment, setDeployment] = useState<DeploymentConfiguration | null>(null);
  const [deploymentValues, setDeploymentValues] = useState<Record<string, string>>({});
  const [deploymentPreview, setDeploymentPreview] = useState<DeploymentPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const canManageDeployment = user?.permissions.includes("servers.manage") === true;

  useEffect(() => {
    if (!canManageDeployment) return;
    api<DeploymentConfiguration>("/deployment/configuration")
      .then((data) => {
        setDeployment(data);
        setDeploymentValues(data.current);
      })
      .catch(() => toast.error(t("deploymentLoadFailed")));
  }, [canManageDeployment, t, toast]);

  async function copyDiagnostics() {
    try {
      await navigator.clipboard.writeText(diagnosticsCommand);
      toast.success(t("diagnosticsCopied"));
    } catch {
      toast.error(t("copyFailed"));
    }
  }

  async function previewDeployment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPreviewing(true);
    try {
      const preview = await api<DeploymentPreview>("/deployment/configuration/preview", {
        method: "POST",
        body: JSON.stringify({ changes: deploymentValues }),
      });
      setDeploymentPreview(preview);
      if (preview.valid) toast.success(t("deploymentPreviewReady"));
      else toast.error(t("deploymentPreviewWarnings"));
    } catch {
      toast.error(t("deploymentPreviewFailed"));
    } finally {
      setPreviewing(false);
    }
  }

  async function copyDeploymentPreview() {
    if (!deploymentPreview) return;
    try {
      await navigator.clipboard.writeText(deploymentPreview.dotenv);
      toast.success(t("deploymentPreviewCopied"));
    } catch {
      toast.error(t("copyFailed"));
    }
  }

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <p className="eyebrow">{t("supportEyebrow")}</p>
          <h1>{t("supportTitle")}</h1>
          <p>{t("supportDescription")}</p>
        </div>
      </section>

      <section className="support-channel-grid">
        <article className="panel support-card">
          <span className="support-card-icon">
            <Github size={23} />
          </span>
          <h2>{t("reportProblem")}</h2>
          <p>{t("reportProblemDescription")}</p>
          <div className="heading-actions">
            <a className="button primary" href={issueUrl} target="_blank" rel="noreferrer">
              <CircleHelp size={17} />
              {t("openGithubIssue")}
            </a>
            <a className="button ghost" href={repositoryUrl} target="_blank" rel="noreferrer">
              {t("viewRepository")}
              <ExternalLink size={15} />
            </a>
          </div>
        </article>

        <article className="panel support-card">
          <span className="support-card-icon">
            <Mail size={23} />
          </span>
          <h2>{t("emailSupport")}</h2>
          <p>{t("emailSupportDescription")}</p>
          <div className="heading-actions">
            <a
              className="button primary"
              href={`mailto:${supportEmail}?subject=${encodeURIComponent("CS 1.6 Server CP support")}`}
            >
              <Mail size={17} />
              {t("sendEmail")}
            </a>
            <a className="button ghost" href={`mailto:${supportEmail}`}>
              {supportEmail}
            </a>
          </div>
        </article>
      </section>

      <section className="panel diagnostics-card">
        <header>
          <div>
            <p className="eyebrow">{t("beforeReporting")}</p>
            <h2>{t("diagnosticsTitle")}</h2>
          </div>
          <button className="button ghost" type="button" onClick={copyDiagnostics}>
            <Clipboard size={16} />
            {t("copyDiagnostics")}
          </button>
        </header>
        <p>{t("diagnosticsDescription")}</p>
        <pre className="diagnostics-command">{diagnosticsCommand}</pre>
      </section>

      {canManageDeployment && (
        <section className="panel diagnostics-card">
          <header>
            <div>
              <p className="eyebrow">{t("deploymentEyebrow")}</p>
              <h2>{t("deploymentAssistant")}</h2>
            </div>
            <span className="support-card-icon">
              <FileCog size={23} />
            </span>
          </header>
          <p>{t("deploymentAssistantDescription")}</p>
          <p className="donation-note">{t("deploymentReadOnlyNotice")}</p>
          {deployment && (
            <form className="form-grid" onSubmit={previewDeployment}>
              {deploymentFields
                .filter((field) => deployment.allowlist.includes(field))
                .map((field) => (
                  <label key={field}>
                    <span>{field}</span>
                    <input
                      value={deploymentValues[field] || ""}
                      onChange={(event) =>
                        setDeploymentValues((current) => ({ ...current, [field]: event.target.value }))
                      }
                    />
                  </label>
                ))}
              <div className="full heading-actions">
                <button className="button primary" type="submit" disabled={previewing}>
                  <FileCog size={17} />
                  {previewing ? t("loading") : t("previewDeployment")}
                </button>
              </div>
            </form>
          )}
          {deploymentPreview && (
            <div>
              <div className="heading-actions">
                <strong>{deploymentPreview.valid ? t("configurationValid") : t("configurationHasWarnings")}</strong>
                <button className="button ghost" type="button" onClick={copyDeploymentPreview}>
                  <Clipboard size={16} />
                  {t("copyEnvPreview")}
                </button>
              </div>
              {deploymentPreview.warnings.length > 0 && (
                <ul>
                  {deploymentPreview.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              )}
              <pre className="diagnostics-command">{deploymentPreview.dotenv}</pre>
            </div>
          )}
        </section>
      )}

      <section className="panel donation-section">
        <header>
          <div>
            <p className="eyebrow">{t("supportDevelopment")}</p>
            <h2>{t("donateTitle")}</h2>
          </div>
          <span className="support-card-icon">
            <HeartHandshake size={23} />
          </span>
        </header>
        <p>{t("donateDescription")}</p>
        <div className="donation-grid">
          {donationOptions.map((option) => (
            <a key={option.name} className="donation-option" href={option.href} target="_blank" rel="noreferrer">
              <span className="donation-icon" aria-hidden="true">
                {option.mark}
              </span>
              <span>
                <strong>{option.name}</strong>
                <small>{t(option.descriptionKey)}</small>
              </span>
              <ExternalLink size={16} />
            </a>
          ))}
        </div>
        <p className="donation-note">{t("externalPaymentNotice")}</p>
      </section>
    </div>
  );
}
