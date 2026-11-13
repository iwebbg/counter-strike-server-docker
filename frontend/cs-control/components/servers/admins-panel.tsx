"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/components/i18n-provider";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { api } from "@/lib/api";

type Admin = { steamId: string; flags: string };
const roles = { full: "abcdefghijklmnopqrstu", moderator: "bcdefijm", maps: "fj" };
const pageSize = 10;

export function AdminsPanel({ serverId }: { serverId: string }) {
  const toast = useToast();
  const { t } = useI18n();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [source, setSource] = useState("");
  const [fleet, setFleet] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Admin | null>(null);
  const [deleting, setDeleting] = useState<Admin | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const load = useCallback(async () => {
    try {
      const result = await api<{ admins: Admin[]; source: string }>(`/servers/${serverId}/admins`);
      setAdmins(result.admins);
      setSource(result.source);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("requestFailed"));
    }
  }, [serverId, t, toast]);
  useEffect(() => {
    load();
  }, [load]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? admins.filter((admin) => `${admin.steamId} ${admin.flags}`.toLowerCase().includes(needle)) : admins;
  }, [admins, query]);
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => setPage(1), [query]);
  async function persist(next: Admin[]) {
    setPending(true);
    try {
      await api(`/servers/${serverId}/admins`, {
        method: "PUT",
        body: JSON.stringify({ admins: next, scope: fleet ? "fleet" : "server" }),
      });
      toast.success(t("adminsSaved"));
      await load();
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("requestFailed"));
      return false;
    } finally {
      setPending(false);
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const role = String(form.get("role"));
    const item = {
      steamId: String(form.get("steamId") || "").trim(),
      flags: role === "custom" ? String(form.get("flags") || "") : roles[role as keyof typeof roles],
    };
    const next = editing
      ? admins.map((admin) => (admin.steamId === editing.steamId ? item : admin))
      : [...admins, item];
    if (await persist(next)) {
      setCreating(false);
      setEditing(null);
    }
  }
  async function remove() {
    if (!deleting) return;
    if (await persist(admins.filter((admin) => admin.steamId !== deleting.steamId))) setDeleting(null);
  }
  async function reset() {
    setPending(true);
    try {
      await api(`/servers/${serverId}/admins`, { method: "DELETE" });
      toast.success(t("adminsReset"));
      setResetOpen(false);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("requestFailed"));
    } finally {
      setPending(false);
    }
  }
  const formAdmin = editing || { steamId: "", flags: roles.full };
  const selectedRole = Object.entries(roles).find(([, flags]) => flags === formAdmin.flags)?.[0] || "custom";
  return (
    <section className="management-panel">
      <header>
        <div>
          <p className="eyebrow">{t("liveAmxxAccess")}</p>
          <h2>{t("serverAdmins")}</h2>
        </div>
        <div className="badges">
          <span>{source || "—"}</span>
        </div>
      </header>
      <div className="table-toolbar">
        <label className="search-field">
          <Search size={16} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("search")} />
        </label>
        <label className="scope-field">
          <input type="checkbox" checked={fleet} onChange={(event) => setFleet(event.target.checked)} />
          {t("fleetAdmins")}
        </label>
        <button className="button primary" onClick={() => setCreating(true)}>
          <Plus size={15} />
          {t("addAdmin")}
        </button>
      </div>
      <div className="table-panel">
        <div className="table-head admin-grid">
          <span>{t("steamId")}</span>
          <span>{t("role")}</span>
          <span>{t("flags")}</span>
          <span>{t("actions")}</span>
        </div>
        {visible.map((admin) => (
          <div className="table-row admin-grid" key={admin.steamId}>
            <code>{admin.steamId}</code>
            <span>
              {t(
                Object.entries(roles).find(([, flags]) => flags === admin.flags)?.[0] === "full"
                  ? "fullAdmin"
                  : Object.entries(roles).find(([, flags]) => flags === admin.flags)?.[0] === "moderator"
                    ? "moderator"
                    : Object.entries(roles).find(([, flags]) => flags === admin.flags)?.[0] === "maps"
                      ? "mapsVotes"
                      : "customFlags",
              )}
            </span>
            <code>{admin.flags}</code>
            <div className="row-actions">
              <button onClick={() => setEditing(admin)}>
                <Pencil size={15} />
              </button>
              <button className="danger-action" onClick={() => setDeleting(admin)}>
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
        {!visible.length && <p className="empty-copy">{t("noAdmins")}</p>}
        <Pagination page={page} pageSize={pageSize} totalItems={filtered.length} onPageChange={setPage} />
      </div>
      <footer className="management-actions">
        <button className="button ghost" onClick={() => setResetOpen(true)}>
          {t("resetEnv")}
        </button>
      </footer>
      <Modal
        open={creating || Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) {
            setCreating(false);
            setEditing(null);
          }
        }}
        title={editing ? t("editAdminTitle") : t("addAdminTitle")}
        eyebrow={t("liveAmxxAccess")}
      >
        <form className="form-grid" onSubmit={submit} key={editing?.steamId || "new"}>
          <label className="full">
            <span>{t("steamId")}</span>
            <input
              name="steamId"
              defaultValue={formAdmin.steamId}
              pattern="STEAM_[0-9]+:[01]:[0-9]+"
              placeholder="STEAM_0:1:123456"
              required
            />
          </label>
          <label>
            <span>{t("role")}</span>
            <select name="role" defaultValue={selectedRole}>
              <option value="full">{t("fullAdmin")}</option>
              <option value="moderator">{t("moderator")}</option>
              <option value="maps">{t("mapsVotes")}</option>
              <option value="custom">{t("customFlags")}</option>
            </select>
          </label>
          <label>
            <span>{t("flags")}</span>
            <input name="flags" defaultValue={formAdmin.flags} pattern="[a-u]+" required />
          </label>
          <footer className="form-actions full">
            <button
              type="button"
              className="button ghost"
              onClick={() => {
                setCreating(false);
                setEditing(null);
              }}
            >
              {t("cancel")}
            </button>
            <button className="button primary" disabled={pending}>
              {t("save")}
            </button>
          </footer>
        </form>
      </Modal>
      <ConfirmModal
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t("deleteAdminTitle")}
        description={t("deleteAdminConfirm", { steamId: deleting?.steamId || "" })}
        confirmLabel={t("delete")}
        pending={pending}
        onConfirm={remove}
      />
      <ConfirmModal
        open={resetOpen}
        onOpenChange={setResetOpen}
        title={t("resetEnv")}
        description={t("resetEnv")}
        confirmLabel={t("confirm")}
        pending={pending}
        onConfirm={reset}
      />
    </section>
  );
}
