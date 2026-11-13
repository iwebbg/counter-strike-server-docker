"use client";

import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { useI18n } from "@/components/i18n-provider";

export default function LoginPage() {
  const { locale, setLocale, t } = useI18n();
  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-top">
          <span className="brand-mark">CS</span>
          <select
            aria-label="Language"
            value={locale}
            onChange={(e) => setLocale(e.target.value === "en" ? "en" : "bg")}
          >
            <option value="bg">BG</option>
            <option value="en">EN</option>
          </select>
        </div>
        <h1>{t("loginTitle")}</h1>
        <p>{t("loginDescription")}</p>
        <Suspense>
          <LoginForm />
        </Suspense>
        <footer>
          {t("poweredBy")}{" "}
          <a href="https://interweb.bg" target="_blank" rel="noreferrer">
            InterWeb
          </a>
        </footer>
      </section>
    </main>
  );
}
