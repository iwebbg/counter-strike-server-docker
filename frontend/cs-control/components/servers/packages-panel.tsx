"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { RefreshCw, Trash2, Upload } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/components/i18n-provider";
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
  const [replace, setReplace] = useState<PackageItem | null>(null);
  const [pending, setPending] = useState(false);
  const load = useCallback(async () => {
    try {
      setData(await api<PackagePayload>(`/servers/${serverId}/map-packages`));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "REQUEST_FAILED");
    }
  }, [serverId, toast]);
  useEffect(() => {
    load();
  }, [load]);
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get("package") as File;
    if (!file?.name.toLowerCase().endsWith(".zip")) return toast.error("Select a ZIP package");
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
      toast.success(replace ? "Package replaced" : "Package uploaded");
      setReplace(null);
      event.currentTarget.reset();
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "REQUEST_FAILED");
    } finally {
      setPending(false);
    }
  }
  async function remove(item: PackageItem) {
    if (!confirm(`Delete ${item.name}?`)) return;
    try {
      await api(`/servers/${serverId}/map-packages/${item.id}`, { method: "DELETE" });
      toast.success("Package deleted");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "REQUEST_FAILED");
    }
  }
  return (
    <section className="management-panel">
      <header>
        <div>
          <p className="eyebrow">CUSTOM CONTENT</p>
          <h2>{t("mapPackages")}</h2>
        </div>
        <button className="button ghost" onClick={load}>
          <RefreshCw size={15} />
          {t("refresh")}
        </button>
      </header>
      <form className="package-upload" onSubmit={upload}>
        <input name="package" type="file" accept=".zip,application/zip" required />
        <input name="name" placeholder={replace ? replace.name : t("displayName")} />
        <select name="mode" defaultValue={replace?.mode || "auto"}>
          <option value="auto">{t("autoDetect")}</option>
          <option value="classic">Classic</option>
          <option value="gungame">GunGame</option>
        </select>
        <button className="button primary" disabled={pending}>
          <Upload size={15} />
          {replace ? t("replace") : t("uploadValidate")}
        </button>
        {replace && (
          <button type="button" className="button ghost" onClick={() => setReplace(null)}>
            Cancel replacement
          </button>
        )}
      </form>
      {data?.unmanagedFiles ? (
        <p className="warning-copy">{data.unmanagedFiles} unmanaged legacy resource(s) are preserved.</p>
      ) : null}
      <div className="package-list">
        {data?.packages.map((item) => {
          const blocked = item.maps.includes(data.current) || item.maps.some((map) => data.selected.includes(map));
          return (
            <article key={item.id}>
              <div>
                <strong>{item.name}</strong>
                <span>{item.maps.join(", ")}</span>
                <small>
                  {item.files.length} files · {(item.bytes / 1048576).toFixed(1)} MiB · {item.source}
                </small>
                <div className="badges">
                  <span>{item.mode}</span>
                  {blocked && <span className="current">IN ROTATION</span>}
                </div>
              </div>
              <div>
                <button onClick={() => setReplace(item)}>{t("replace")}</button>
                <button disabled={blocked} className="danger-action" onClick={() => remove(item)}>
                  <Trash2 size={14} />
                  Delete
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
