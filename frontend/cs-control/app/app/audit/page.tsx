"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Filter } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";

type AuditEvent = {
  id: string;
  actorName?: string;
  actorEmail?: string;
  action: string;
  status: string;
  serverId?: string;
  targetName?: string;
  targetId?: string;
  requestId?: string;
  ipAddress?: string;
  createdAt: string;
};
type AuditPayload = {
  events: AuditEvent[];
  actions: string[];
  operators: Array<{ id: string; name?: string; email?: string }>;
};

export default function AuditPage() {
  const { t, locale } = useI18n();
  const toast = useToast();
  const [data, setData] = useState<AuditPayload>({ events: [], actions: [], operators: [] });
  const [query, setQuery] = useState("");
  const load = useCallback(
    async (params = "") => {
      try {
        setData(await api<AuditPayload>(`/audit-logs?limit=200${params}`));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("requestFailed"));
      }
    },
    [t, toast],
  );
  useEffect(() => {
    load();
  }, [load]);
  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const params = new URLSearchParams();
    for (const key of ["operatorId", "action", "status"]) {
      const value = String(form.get(key) || "");
      if (value) params.set(key, value);
    }
    setQuery(params.toString());
    load(params.size ? `&${params}` : "");
  }
  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <p className="eyebrow">CONTROL PLANE HISTORY</p>
          <h1>{t("auditTitle")}</h1>
          <p>{t("auditDescription")}</p>
        </div>
      </section>
      <form className="audit-filters" onSubmit={filter}>
        <select name="operatorId">
          <option value="">
            {t("operator")}: {t("all")}
          </option>
          {data.operators.map((operator) => (
            <option key={operator.id} value={operator.id}>
              {operator.name || operator.email}
            </option>
          ))}
        </select>
        <select name="action">
          <option value="">
            {t("action")}: {t("all")}
          </option>
          {data.actions.map((action) => (
            <option key={action}>{action}</option>
          ))}
        </select>
        <select name="status">
          <option value="">
            {t("result")}: {t("all")}
          </option>
          <option value="success">Success</option>
          <option value="failure">Failure</option>
          <option value="denied">Denied</option>
        </select>
        <button className="button primary">
          <Filter size={16} />
          Filter
        </button>
      </form>
      <section className="panel audit-list">
        {data.events.map((event) => (
          <article key={event.id}>
            <span className={`audit-status ${event.status}`}>{event.status}</span>
            <div>
              <strong>{event.action}</strong>
              <small>
                {event.actorName || event.actorEmail || "System"}
                {event.serverId && ` · ${event.serverId}`}
                {(event.targetName || event.targetId) && ` · ${event.targetName || event.targetId}`}
              </small>
            </div>
            <code title={`${event.requestId || ""} ${event.ipAddress || ""}`}>
              {new Intl.DateTimeFormat(locale === "bg" ? "bg-BG" : "en-GB", {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(event.createdAt))}
            </code>
          </article>
        ))}
        {!data.events.length && <p className="empty-copy">No audit events{query ? " for this filter" : ""}.</p>}
      </section>
    </div>
  );
}
