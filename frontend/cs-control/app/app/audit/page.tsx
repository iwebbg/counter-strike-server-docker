"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Filter } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { useToast } from "@/components/ui/toast";
import { Pagination } from "@/components/ui/pagination";
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
  const [page, setPage] = useState(1);
  const pageSize = 15;
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
    setPage(1);
    load(params.size ? `&${params}` : "");
  }
  const visibleEvents = data.events.slice((page - 1) * pageSize, page * pageSize);
  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <p className="eyebrow">{t("controlPlaneHistory")}</p>
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
          <option value="success">{t("success")}</option>
          <option value="failure">{t("failure")}</option>
          <option value="denied">{t("denied")}</option>
        </select>
        <button className="button primary">
          <Filter size={16} />
          {t("filter")}
        </button>
      </form>
      <section className="panel audit-list">
        {visibleEvents.map((event) => (
          <article key={event.id}>
            <span className={`audit-status ${event.status}`}>{event.status}</span>
            <div>
              <strong>{event.action}</strong>
              <small>
                {event.actorName || event.actorEmail || t("system")}
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
        {!data.events.length && <p className="empty-copy">{t(query ? "noAuditEventsFiltered" : "noAuditEvents")}</p>}
        <Pagination page={page} pageSize={pageSize} totalItems={data.events.length} onPageChange={setPage} />
      </section>
    </div>
  );
}
