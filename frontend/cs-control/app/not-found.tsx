"use client";

import Link from "next/link";
import { ArrowLeft, CircleHelp, LayoutDashboard, MapPinOff } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n-provider";

export default function NotFound() {
  const pathname = usePathname();
  const router = useRouter();
  const { locale, setLocale, t } = useI18n();

  return (
    <main className="not-found-page">
      <header className="not-found-header">
        <Link className="not-found-brand" href="/app">
          <span className="brand-mark">CS</span>
          <span>
            <strong>CS 1.6 Server CP</strong>
            <small>
              {t("poweredBy")} <b>InterWeb</b>
            </small>
          </span>
        </Link>
        <select
          aria-label="Language"
          value={locale}
          onChange={(event) => setLocale(event.target.value === "en" ? "en" : "bg")}
        >
          <option value="bg">BG</option>
          <option value="en">EN</option>
        </select>
      </header>

      <section className="not-found-card">
        <div className="not-found-code" aria-hidden="true">
          <span>ERROR</span>
          <strong>404</strong>
        </div>
        <div className="not-found-content">
          <span className="support-card-icon">
            <MapPinOff size={23} />
          </span>
          <p className="eyebrow">{t("notFoundEyebrow")}</p>
          <h1>{t("notFoundTitle")}</h1>
          <p>{t("notFoundDescription")}</p>
          <code>{pathname}</code>
          <div className="not-found-actions">
            <Link className="button primary" href="/app">
              <LayoutDashboard size={17} />
              {t("goToDashboard")}
            </Link>
            <button className="button ghost" type="button" onClick={() => router.back()}>
              <ArrowLeft size={17} />
              {t("goBack")}
            </button>
            <Link className="button ghost" href="/app/support">
              <CircleHelp size={17} />
              {t("getHelp")}
            </Link>
          </div>
        </div>
      </section>

      <footer className="not-found-footer">
        <span>{t("notFoundHint")}</span>
        <a href="https://interweb.bg" target="_blank" rel="noreferrer">
          interweb.bg
        </a>
      </footer>
    </main>
  );
}
