"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Plus, Save, Trash2, KeyRound } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";

type Operator = { id: string; name: string; email: string; role: string; active: boolean; preferredLocale: string };

export default function OperatorsPage() {
  const { t } = useI18n();
  const toast = useToast();
  const [operators, setOperators] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const load = useCallback(async () => {
    try {
      setOperators((await api<{ operators: Operator[] }>("/operators")).operators);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("requestFailed"));
    } finally {
      setLoading(false);
    }
  }, [t, toast]);
  useEffect(() => {
    load();
  }, [load]);
  const save = async (operator: Operator) => {
    try {
      await api(`/operators/${operator.id}`, {
        method: "PUT",
        body: JSON.stringify({ name: operator.name, role: operator.role, active: operator.active }),
      });
      toast.success("Operator updated");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("requestFailed"));
    }
  };
  const password = async (operator: Operator) => {
    const value = prompt(`New password for ${operator.email}`);
    if (!value) return;
    try {
      await api(`/operators/${operator.id}/password`, { method: "PUT", body: JSON.stringify({ password: value }) });
      toast.success("Password changed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("requestFailed"));
    }
  };
  const remove = async (operator: Operator) => {
    if (!confirm(`Delete ${operator.email}?`)) return;
    try {
      await api(`/operators/${operator.id}`, { method: "DELETE" });
      toast.success("Operator deleted");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("requestFailed"));
    }
  };
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api("/operators", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          password: form.get("password"),
          role: form.get("role"),
          preferredLocale: form.get("preferredLocale"),
        }),
      });
      toast.success("Operator created");
      setOpen(false);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("requestFailed"));
    }
  }
  const patch = (id: string, changes: Partial<Operator>) =>
    setOperators((current) => current.map((operator) => (operator.id === id ? { ...operator, ...changes } : operator)));
  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <p className="eyebrow">ACCESS CONTROL</p>
          <h1>{t("operatorsTitle")}</h1>
          <p>{t("operatorsDescription")}</p>
        </div>
        <button className="button primary" onClick={() => setOpen(true)}>
          <Plus size={17} />
          {t("addOperator")}
        </button>
      </section>
      <section className="panel table-panel">
        <div className="table-head operator-grid">
          <span>{t("name")}</span>
          <span>{t("role")}</span>
          <span>{t("active")}</span>
          <span />
        </div>
        {operators.map((operator) => (
          <div className="table-row operator-grid" key={operator.id}>
            <div>
              <input value={operator.name} onChange={(event) => patch(operator.id, { name: event.target.value })} />
              <small>{operator.email}</small>
            </div>
            <select value={operator.role} onChange={(event) => patch(operator.id, { role: event.target.value })}>
              <option value="viewer">Viewer</option>
              <option value="moderator">Moderator</option>
              <option value="admin">Admin</option>
              <option value="owner">Owner</option>
            </select>
            <label className="switch-label">
              <input
                type="checkbox"
                checked={operator.active}
                onChange={(event) => patch(operator.id, { active: event.target.checked })}
              />
              <span>{t(operator.active ? "active" : "inactive")}</span>
            </label>
            <div className="row-actions">
              <button onClick={() => save(operator)}>
                <Save size={15} />
              </button>
              <button onClick={() => password(operator)}>
                <KeyRound size={15} />
              </button>
              <button className="danger-action" onClick={() => remove(operator)}>
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
        {loading && <p className="empty-copy">{t("loading")}</p>}
      </section>
      <Modal open={open} onOpenChange={setOpen} title={t("addOperator")} eyebrow="ACCESS CONTROL">
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
            <select name="role">
              <option value="viewer">Viewer</option>
              <option value="moderator">Moderator</option>
              <option value="admin">Admin</option>
              <option value="owner">Owner</option>
            </select>
          </label>
          <label>
            <span>Language</span>
            <select name="preferredLocale">
              <option value="bg">BG</option>
              <option value="en">EN</option>
            </select>
          </label>
          <footer className="form-actions full">
            <button type="button" className="button ghost" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button className="button primary">{t("addOperator")}</button>
          </footer>
        </form>
      </Modal>
    </div>
  );
}
