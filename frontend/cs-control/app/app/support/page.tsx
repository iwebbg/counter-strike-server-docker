"use client";

import { CircleHelp, Clipboard, ExternalLink, Github, HeartHandshake, Mail } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { useToast } from "@/components/ui/toast";

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

export default function SupportPage() {
  const { t } = useI18n();
  const toast = useToast();

  async function copyDiagnostics() {
    try {
      await navigator.clipboard.writeText(diagnosticsCommand);
      toast.success(t("diagnosticsCopied"));
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
