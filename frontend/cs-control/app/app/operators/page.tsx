"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { KeyRound, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import type { Server } from "@/lib/types";

type Operator = {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  preferredLocale: string;
  customPermissions: string[] | null;
  serverScopes: string[];
};
const pageSize = 10;
const permissionCodes = [
  "servers.read",
  "servers.operate",
  "servers.manage",
  "players.moderate",
  "maps.manage",
  "admins.manage",
  "backups.manage",
  "stats.read",
  "seasons.manage",
  "moderation.manage",
  "audit.read",
  "operators.manage",
];

function AccessFields({ servers, operator }: { servers: Server[]; operator?: Operator }) {
  const { t } = useI18n();
  return (
    <>
      <fieldset className="full access-fieldset">
        <legend>{t("customPermissions")}</legend>
        <p>{t("customPermissionsHint")}</p>
        <div className="access-check-grid">
          {permissionCodes.map((permission) => (
            <label className="checkbox" key={permission}>
              <input
                type="checkbox"
                name="customPermissions"
                value={permission}
                defaultChecked={operator?.customPermissions?.includes(permission)}
              />
              <span>{permission}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="full access-fieldset">
        <legend>{t("serverAccess")}</legend>
        <p>{t("serverAccessHint")}</p>
        <div className="access-check-grid">
          {servers.map((server) => {
            const id = server.serverId || server.id;
            return (
              <label className="checkbox" key={id}>
                <input
                  type="checkbox"
                  name="serverScopes"
                  value={id}
                  defaultChecked={operator?.serverScopes.includes(id)}
                />
                <span>{server.name}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
    </>
  );
}

export default function OperatorsPage() {
  const { t } = useI18n();
  const toast = useToast();
  const [operators, setOperators] = useState<Operator[]>([]);
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Operator | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<Operator | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Operator | null>(null);
  const [pending, setPending] = useState(false);
  const load = useCallback(async () => {
    try {
      const [operatorData, serverData] = await Promise.all([
        api<{ operators: Operator[] }>("/operators"),
        api<{ servers: Server[] }>("/servers"),
      ]);
      setOperators(operatorData.operators);
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
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle
      ? operators.filter((operator) =>
          [operator.name, operator.email, operator.role].some((value) => value.toLowerCase().includes(needle)),
        )
      : operators;
  }, [operators, query]);
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => setPage(1), [query]);
  useEffect(() => {
    const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
    if (page > pages) setPage(pages);
  }, [filtered.length, page]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    try {
      const role = String(form.get("role"));
      await api("/operators", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          password: form.get("password"),
          role,
          preferredLocale: form.get("preferredLocale"),
          ...(role === "custom" ? { customPermissions: form.getAll("customPermissions") } : {}),
          serverScopes: form.getAll("serverScopes"),
        }),
      });
      toast.success(t("operatorCreated"));
      setCreateOpen(false);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("requestFailed"));
    } finally {
      setPending(false);
    }
  }
  async function update(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const form = new FormData(event.currentTarget);
    setPending(true);
    try {
      const role = String(form.get("role"));
      await api(`/operators/${editing.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: form.get("name"),
          role,
          active: form.get("active") === "on",
          ...(role === "custom" ? { customPermissions: form.getAll("customPermissions") } : {}),
          serverScopes: form.getAll("serverScopes"),
        }),
      });
      toast.success(t("operatorUpdated"));
      setEditing(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("requestFailed"));
    } finally {
      setPending(false);
    }
  }
  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!passwordTarget) return;
    const form = new FormData(event.currentTarget);
    setPending(true);
    try {
      await api(`/operators/${passwordTarget.id}/password`, {
        method: "PUT",
        body: JSON.stringify({ password: form.get("password") }),
      });
      toast.success(t("passwordChanged"));
      setPasswordTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("requestFailed"));
    } finally {
      setPending(false);
    }
  }
  async function remove() {
    if (!deleteTarget) return;
    setPending(true);
    try {
      await api(`/operators/${deleteTarget.id}`, { method: "DELETE" });
      toast.success(t("operatorDeleted"));
      setDeleteTarget(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("requestFailed"));
    } finally {
      setPending(false);
    }
  }
  const roleOptions = (
    <>
      <option value="viewer">{t("roleViewer")}</option>
      <option value="moderator">{t("moderator")}</option>
      <option value="admin">{t("roleAdmin")}</option>
      <option value="owner">{t("roleOwner")}</option>
      <option value="custom">{t("roleCustom")}</option>
    </>
  );
  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <p className="eyebrow">{t("accessControl")}</p>
          <h1>{t("operatorsTitle")}</h1>
          <p>{t("operatorsDescription")}</p>
        </div>
        <button className="button primary" onClick={() => setCreateOpen(true)}>
          <Plus size={17} />
          {t("addOperator")}
        </button>
      </section>
      <section className="panel table-panel">
        <div className="table-toolbar">
          <label className="search-field">
            <Search size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("search")} />
          </label>
        </div>
        <div className="table-head operator-grid">
          <span>{t("name")}</span>
          <span>{t("role")}</span>
          <span>{t("status")}</span>
          <span>{t("actions")}</span>
        </div>
        {visible.map((operator) => (
          <div className="table-row operator-grid" key={operator.id}>
            <div>
              <strong>{operator.name}</strong>
              <small>{operator.email}</small>
            </div>
            <span className="role-badge">
              {t(
                operator.role === "viewer"
                  ? "roleViewer"
                  : operator.role === "moderator"
                    ? "moderator"
                    : operator.role === "admin"
                      ? "roleAdmin"
                      : operator.role === "owner"
                        ? "roleOwner"
                        : "roleCustom",
              )}
            </span>
            <span className={operator.active ? "status-text active" : "status-text"}>
              {t(operator.active ? "active" : "inactive")}
            </span>
            <div className="row-actions">
              <button onClick={() => setEditing(operator)} title={t("editOperator")}>
                <Pencil size={15} />
              </button>
              <button onClick={() => setPasswordTarget(operator)} title={t("resetPassword")}>
                <KeyRound size={15} />
              </button>
              <button className="danger-action" onClick={() => setDeleteTarget(operator)} title={t("deleteOperator")}>
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
        {loading && <p className="empty-copy">{t("loading")}</p>}
        {!loading && !visible.length && <p className="empty-copy">{t("noOperators")}</p>}
        <Pagination page={page} pageSize={pageSize} totalItems={filtered.length} onPageChange={setPage} />
      </section>
      <Modal open={createOpen} onOpenChange={setCreateOpen} title={t("addOperator")} eyebrow={t("accessControl")}>
        <form className="form-grid" onSubmit={create}>
          <label className="full">
            <span>{t("name")}</span>
            <input name="name" minLength={2} required />
          </label>
          <label className="full">
            <span>{t("email")}</span>
            <input name="email" type="email" required />
          </label>
          <label className="full">
            <span>{t("password")}</span>
            <input name="password" type="password" minLength={12} required />
          </label>
          <label>
            <span>{t("role")}</span>
            <select name="role">{roleOptions}</select>
          </label>
          <AccessFields servers={servers} />
          <label>
            <span>{t("preferredLanguage")}</span>
            <select name="preferredLocale">
              <option value="bg">BG</option>
              <option value="en">EN</option>
            </select>
          </label>
          <footer className="form-actions full">
            <button type="button" className="button ghost" onClick={() => setCreateOpen(false)}>
              {t("cancel")}
            </button>
            <button className="button primary" disabled={pending}>
              {t("addOperator")}
            </button>
          </footer>
        </form>
      </Modal>
      <Modal
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
        title={t("editOperator")}
        eyebrow={t("accessControl")}
      >
        {editing && (
          <form className="form-grid" onSubmit={update} key={editing.id}>
            <label className="full">
              <span>{t("name")}</span>
              <input name="name" defaultValue={editing.name} minLength={2} required />
            </label>
            <label className="full">
              <span>{t("email")}</span>
              <input value={editing.email} disabled />
            </label>
            <label>
              <span>{t("role")}</span>
              <select name="role" defaultValue={editing.role}>
                {roleOptions}
              </select>
            </label>
            <label className="checkbox">
              <input name="active" type="checkbox" defaultChecked={editing.active} />
              <span>{t("active")}</span>
            </label>
            <AccessFields servers={servers} operator={editing} />
            <footer className="form-actions full">
              <button type="button" className="button ghost" onClick={() => setEditing(null)}>
                {t("cancel")}
              </button>
              <button className="button primary" disabled={pending}>
                {t("save")}
              </button>
            </footer>
          </form>
        )}
      </Modal>
      <Modal
        open={Boolean(passwordTarget)}
        onOpenChange={(open) => !open && setPasswordTarget(null)}
        title={t("resetPassword")}
        eyebrow={t("accessControl")}
      >
        {passwordTarget && (
          <form className="form-grid" onSubmit={changePassword} key={passwordTarget.id}>
            <p className="modal-copy full">{passwordTarget.email}</p>
            <label className="full">
              <span>{t("newPassword")}</span>
              <input name="password" type="password" minLength={12} required autoFocus />
            </label>
            <footer className="form-actions full">
              <button type="button" className="button ghost" onClick={() => setPasswordTarget(null)}>
                {t("cancel")}
              </button>
              <button className="button primary" disabled={pending}>
                {t("save")}
              </button>
            </footer>
          </form>
        )}
      </Modal>
      <ConfirmModal
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t("deleteOperator")}
        description={t("deleteOperatorConfirm", { email: deleteTarget?.email || "" })}
        confirmLabel={t("delete")}
        pending={pending}
        onConfirm={remove}
      />
    </div>
  );
}
