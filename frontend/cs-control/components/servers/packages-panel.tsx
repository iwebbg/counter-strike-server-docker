"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Pencil, Plus, Search, Trash2, Upload } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/components/i18n-provider";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { api } from "@/lib/api";

type PackageItem = {
  id: string;
  name: string;
  mode: string;
  maps: string[];
  files: string[];
  bytes: number;
  source: string;
};
type PackagePayload = { packages: PackageItem[]; selected: string[]; current: string; unmanagedFiles: number };
const pageSize = 10;
async function base64(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let value = "";
  for (let i = 0; i < bytes.length; i += 32768) value += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(value);
}
export function PackagesPanel({ serverId }: { serverId: string }) {
  const toast = useToast();
  const { t } = useI18n();
  const [data, setData] = useState<PackagePayload | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [replace, setReplace] = useState<PackageItem | null>(null);
  const [deleting, setDeleting] = useState<PackageItem | null>(null);
  const [pending, setPending] = useState(false);
  const load = useCallback(async () => {
    try {
      setData(await api<PackagePayload>(`/servers/${serverId}/map-packages`));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("requestFailed"));
    }
  }, [serverId, t, toast]);
  useEffect(() => {
    load();
  }, [load]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const packages = data?.packages || [];
    return needle
      ? packages.filter((item) => `${item.name} ${item.mode} ${item.maps.join(" ")}`.toLowerCase().includes(needle))
      : packages;
  }, [data, query]);
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => setPage(1), [query]);
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get("package") as File;
    if (!file?.name.toLowerCase().endsWith(".zip")) return toast.error(t("selectZipPackage"));
    setPending(true);
    try {
      await api(`/servers/${serverId}/map-packages/zip`, {
        method: "POST",
        body: JSON.stringify({
          filename: file.name,
          name: form.get("name") || undefined,
          mode: form.get("mode"),
          content: await base64(file),
          replacePackageId: replace?.id,
        }),
      });
      toast.success(t(replace ? "packageReplaced" : "packageUploaded"));
      setReplace(null);
      setUploadOpen(false);
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
      await api(`/servers/${serverId}/map-packages/${deleting.id}`, { method: "DELETE" });
      toast.success(t("packageDeleted"));
      setDeleting(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("requestFailed"));
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="management-panel">
      <header>
        <div>
          <p className="eyebrow">{t("customContent")}</p>
          <h2>{t("mapPackages")}</h2>
        </div>
        <button className="button primary" onClick={() => setUploadOpen(true)}>
          <Plus size={15} />
          {t("addPackage")}
        </button>
      </header>
      <div className="table-toolbar">
        <label className="search-field">
          <Search size={16} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("search")} />
        </label>
      </div>
      {data?.unmanagedFiles ? (
        <p className="warning-copy">{t("unmanagedResources", { count: data.unmanagedFiles })}</p>
      ) : null}
      <div className="table-panel">
        <div className="table-head package-grid">
          <span>{t("displayName")}</span>
          <span>{t("gameMode")}</span>
          <span>{t("maps")}</span>
          <span>{t("actions")}</span>
        </div>
        {visible.map((item) => {
          const blocked =
            item.maps.includes(data?.current || "") || item.maps.some((map) => data?.selected.includes(map));
          return (
            <div className="table-row package-grid" key={item.id}>
              <div>
                <strong>{item.name}</strong>
                <small>
                  {item.files.length} {t("files")} · {(item.bytes / 1048576).toFixed(1)} MiB · {item.source}
                </small>
              </div>
              <span className="role-badge">{item.mode}</span>
              <div className="package-maps">
                <span>{item.maps.join(", ")}</span>
                {blocked && <small>{t("inRotation")}</small>}
              </div>
              <div className="row-actions">
                <button onClick={() => setReplace(item)} title={t("replacePackage")}>
                  <Pencil size={15} />
                </button>
                <button
                  className="danger-action"
                  disabled={blocked}
                  onClick={() => setDeleting(item)}
                  title={t("deletePackage")}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          );
        })}
        {!visible.length && <p className="empty-copy">{t("noPackages")}</p>}
        <Pagination page={page} pageSize={pageSize} totalItems={filtered.length} onPageChange={setPage} />
      </div>
      <Modal
        open={uploadOpen || Boolean(replace)}
        onOpenChange={(open) => {
          if (!open) {
            setUploadOpen(false);
            setReplace(null);
          }
        }}
        title={replace ? t("replacePackage") : t("addPackage")}
        eyebrow={t("customContent")}
        wide
      >
        <form className="form-grid" onSubmit={upload} key={replace?.id || "new"}>
          <label className="full">
            <span>ZIP</span>
            <input name="package" type="file" accept=".zip,application/zip" required />
          </label>
          <label>
            <span>{t("displayName")}</span>
            <input name="name" defaultValue={replace?.name || ""} />
          </label>
          <label>
            <span>{t("gameMode")}</span>
            <select name="mode" defaultValue={replace?.mode || "auto"}>
              <option value="auto">{t("autoDetect")}</option>
              <option value="classic">Classic</option>
              <option value="gungame">GunGame</option>
            </select>
          </label>
          <footer className="form-actions full">
            <button
              type="button"
              className="button ghost"
              onClick={() => {
                setUploadOpen(false);
                setReplace(null);
              }}
            >
              {t("cancel")}
            </button>
            <button className="button primary" disabled={pending}>
              <Upload size={15} />
              {replace ? t("replace") : t("uploadValidate")}
            </button>
          </footer>
        </form>
      </Modal>
      <ConfirmModal
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t("deletePackage")}
        description={t("deletePackageConfirm", { name: deleting?.name || "" })}
        confirmLabel={t("delete")}
        pending={pending}
        onConfirm={remove}
      />
    </section>
  );
}
