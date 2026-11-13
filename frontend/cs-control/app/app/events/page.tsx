"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Pencil, Play, Plus, Search, Trash2 } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import type { Server } from "@/lib/types";

type CommunityEvent = {
  id: string;
  name: string;
  serverId: string;
  dayOfWeek: number;
  startTime: string;
  timezone: string;
  durationMinutes: number;
  startMap: string | null;
  enabled: boolean;
  lastRunAt: string | null;
  lastStatus: string | null;
};

const pageSize = 10;
const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

export default function EventsPage() {
  const { t } = useI18n();
  const toast = useToast();
  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const [servers, setServers] = useState<Server[]>([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CommunityEvent | null>(null);
  const [deleting, setDeleting] = useState<CommunityEvent | null>(null);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [eventData, serverData] = await Promise.all([
        api<{ events: CommunityEvent[] }>("/community-events"),
        api<{ servers: Server[] }>("/servers"),
      ]);
      setEvents(eventData.events);
      setServers(serverData.servers);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("requestFailed"));
    } finally {
      setLoading(false);
    }
  }, [t, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const serverNames = useMemo(
    () => Object.fromEntries(servers.map((server) => [server.serverId || server.id, server.name])),
    [servers],
  );
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle
      ? events.filter((event) =>
          [event.name, serverNames[event.serverId] || event.serverId, event.startMap || ""].some((value) =>
            value.toLowerCase().includes(needle),
          ),
        )
      : events;
  }, [events, query, serverNames]);
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => setPage(1), [query]);

  async function save(event: FormEvent<HTMLFormElement>, target?: CommunityEvent) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    try {
      await api(target ? `/community-events/${target.id}` : "/community-events", {
        method: target ? "PUT" : "POST",
        body: JSON.stringify({
          name: form.get("name"),
          serverId: form.get("serverId"),
          dayOfWeek: Number(form.get("dayOfWeek")),
          startTime: form.get("startTime"),
          timezone: form.get("timezone"),
          durationMinutes: Number(form.get("durationMinutes")),
          startMap: form.get("startMap"),
          enabled: form.get("enabled") === "on",
        }),
      });
      toast.success(t(target ? "eventUpdated" : "eventCreated"));
      setCreating(false);
      setEditing(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("requestFailed"));
    } finally {
      setPending(false);
    }
  }

  async function run(target: CommunityEvent) {
    setPending(true);
    try {
      await api(`/community-events/${target.id}/run`, { method: "POST" });
      toast.success(t("eventStarted"));
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("requestFailed"));
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    if (!deleting) return;
    setPending(true);
    try {
      await api(`/community-events/${deleting.id}`, { method: "DELETE" });
      toast.success(t("eventDeleted"));
      setDeleting(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("requestFailed"));
    } finally {
      setPending(false);
    }
  }

  const eventForm = (target?: CommunityEvent) => (
    <form className="form-grid" onSubmit={(event) => save(event, target)}>
      <label className="full">
        <span>{t("eventName")}</span>
        <input name="name" minLength={2} defaultValue={target?.name || "Friday Night Arena"} required />
      </label>
      <label className="full">
        <span>{t("eventServer")}</span>
        <select name="serverId" defaultValue={target?.serverId} required>
          {servers.map((server) => {
            const id = server.serverId || server.id;
            return (
              <option key={id} value={id}>
                {server.name}
              </option>
            );
          })}
        </select>
      </label>
      <label>
        <span>{t("weekday")}</span>
        <select name="dayOfWeek" defaultValue={target?.dayOfWeek ?? 5}>
          {weekdays.map((day, index) => (
            <option key={day} value={index}>
              {t(day)}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>{t("startTime")}</span>
        <input name="startTime" type="time" defaultValue={target?.startTime || "20:00"} required />
      </label>
      <label>
        <span>{t("timezone")}</span>
        <input name="timezone" defaultValue={target?.timezone || "Europe/Sofia"} required />
      </label>
      <label>
        <span>{t("durationMinutes")}</span>
        <input
          name="durationMinutes"
          type="number"
          min={15}
          max={1440}
          defaultValue={target?.durationMinutes || 180}
          required
        />
      </label>
      <label className="full">
        <span>{t("optionalStartMap")}</span>
        <input name="startMap" pattern="[a-zA-Z0-9_]*" defaultValue={target?.startMap || ""} placeholder="gg_3way" />
      </label>
      <label className="checkbox full">
        <input name="enabled" type="checkbox" defaultChecked={target?.enabled ?? true} />
        <span>{t("enabled")}</span>
      </label>
      <footer className="form-actions full">
        <button type="button" className="button ghost" onClick={() => (target ? setEditing(null) : setCreating(false))}>
          {t("cancel")}
        </button>
        <button className="button primary" disabled={pending || !servers.length}>
          {t("save")}
        </button>
      </footer>
    </form>
  );

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <p className="eyebrow">{t("eventsEyebrow")}</p>
          <h1>{t("eventsTitle")}</h1>
          <p>{t("eventsDescription")}</p>
        </div>
        <button className="button primary" onClick={() => setCreating(true)} disabled={!servers.length}>
          <Plus size={17} /> {t("addEvent")}
        </button>
      </section>
      <section className="panel table-panel">
        <div className="table-toolbar">
          <label className="search-field">
            <Search size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("search")} />
          </label>
        </div>
        <div className="table-head event-grid">
          <span>{t("eventName")}</span>
          <span>{t("eventServer")}</span>
          <span>{t("schedule")}</span>
          <span>{t("status")}</span>
          <span>{t("actions")}</span>
        </div>
        {visible.map((event) => (
          <div className="table-row event-grid" key={event.id}>
            <div>
              <strong>{event.name}</strong>
              <small>{event.startMap || "—"}</small>
            </div>
            <span>{serverNames[event.serverId] || event.serverId}</span>
            <span>
              {t(weekdays[event.dayOfWeek])} · {event.startTime}
            </span>
            <span className={event.enabled ? "status-text active" : "status-text"}>
              {event.lastStatus || t(event.enabled ? "active" : "inactive")}
            </span>
            <div className="row-actions">
              <button onClick={() => run(event)} title={t("runNow")} disabled={pending}>
                <Play size={15} />
              </button>
              <button onClick={() => setEditing(event)} title={t("editEvent")}>
                <Pencil size={15} />
              </button>
              <button className="danger-action" onClick={() => setDeleting(event)} title={t("deleteEvent")}>
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
        {loading && <p className="empty-copy">{t("loading")}</p>}
        {!loading && !visible.length && <p className="empty-copy">{t("noEvents")}</p>}
        <Pagination page={page} pageSize={pageSize} totalItems={filtered.length} onPageChange={setPage} />
      </section>
      <Modal open={creating} onOpenChange={setCreating} title={t("addEvent")} eyebrow={t("eventsEyebrow")} wide>
        {eventForm()}
      </Modal>
      <Modal
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
        title={t("editEvent")}
        eyebrow={t("eventsEyebrow")}
        wide
      >
        {editing && eventForm(editing)}
      </Modal>
      <ConfirmModal
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t("deleteEvent")}
        description={t("deleteEventConfirm", { name: deleting?.name || "" })}
        confirmLabel={t("delete")}
        pending={pending}
        onConfirm={remove}
      />
    </div>
  );
}
