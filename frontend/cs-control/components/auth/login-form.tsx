"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowRight } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { api, ApiError } from "@/lib/api";

function safeRedirect(value: string | null) {
  return value?.startsWith("/app") ? value : "/app";
}

export function LoginForm() {
  const { t } = useI18n();
  const router = useRouter();
  const search = useSearchParams();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    try {
      await api(
        "/v1/users/signin",
        { method: "POST", body: JSON.stringify({ email: form.get("email"), password: form.get("password") }) },
        false,
      );
      router.replace(safeRedirect(search.get("redirect")));
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.code : t("requestFailed"));
    } finally {
      setPending(false);
    }
  }
  return (
    <form className="login-form" onSubmit={submit}>
      <label>
        <span>{t("email")}</span>
        <input name="email" type="email" autoComplete="username" required autoFocus />
      </label>
      <label>
        <span>{t("password")}</span>
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      <button className="button primary login-button" disabled={pending}>
        {pending ? t("signingIn") : t("signIn")}
        <ArrowRight size={17} />
      </button>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
