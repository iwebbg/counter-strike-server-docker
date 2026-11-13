"use client";

import Link from "next/link";
import {
  Archive,
  FileText,
  Map,
  PackageOpen,
  Pencil,
  Play,
  RefreshCw,
  ShieldCheck,
  Square,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import type { Server } from "@/lib/types";

export function ServerCard({
  server,
  permissions,
  pending,
  onAction,
  onLogs,
  onRemove,
  onUpdate,
}: {
  server: Server;
  permissions: string[];
  pending: boolean;
  onAction: (action: "start" | "stop" | "restart") => void;
  onLogs: () => void;
  onRemove: () => void;
  onUpdate: () => void;
}) {
  const { t } = useI18n();
  const running = server.state === "running";
  const operate = permissions.includes("servers.operate");
  const manage = permissions.includes("servers.manage");
  const manageAdmins = permissions.includes("admins.manage");
  const manageBackups = permissions.includes("backups.manage");
  const detailUrl = (tab: string) => `/app/servers/${server.id}?tab=${tab}`;
  return (
    <article className={`server-card ${running ? "online" : ""}`}>
      <header>
        <div className="server-title">
          <span className={`server-orb ${running ? "live" : ""}`} />
          <div>
            <h3>{server.name}</h3>
            <code>{server.containerName}</code>
            {server.imageId && <small>IMAGE {server.imageId.replace("sha256:", "").slice(0, 12)}</small>}
          </div>
        </div>
        <div className="badges">
          <span>{server.mode}</span>
          <span>{server.managedBy}</span>
          {server.managedBy === "panel" && (
            <span className={server.updateAvailable ? "update" : "current"}>
              {t(server.updateAvailable ? "updateAvailable" : "upToDate")}
            </span>
          )}
        </div>
      </header>
      <div className="server-metrics">
        <div>
          <span>{t("status")}</span>
          <strong>{running ? server.health : server.state}</strong>
        </div>
        <div>
          <span>{t("players")}</span>
          <strong>
            {server.players ?? "—"} / {server.liveMaxPlayers || server.maxPlayers}
          </strong>
        </div>
        <div>
          <span>{t("map")}</span>
          <strong>{server.map || server.startMap || "—"}</strong>
        </div>
        <div>
          <span>{t("port")}</span>
          <strong>:{server.port || "—"}</strong>
        </div>
      </div>
      <footer className="server-actions">
        {operate &&
          (running ? (
            <>
              <button disabled={pending} onClick={() => onAction("stop")}>
                <Square size={13} />
                {t("stop")}
              </button>
              <button disabled={pending} onClick={() => onAction("restart")}>
                <RefreshCw size={14} />
                {t("restart")}
              </button>
            </>
          ) : (
            <button className="primary-action" disabled={pending} onClick={() => onAction("start")}>
              <Play size={14} />
              {t("start")}
            </button>
          ))}
        <button onClick={onLogs}>
          <FileText size={14} />
          {t("logs")}
        </button>
        {manage && server.managedBy === "panel" && (
          <Link className="card-link" href={detailUrl("configuration")}>
            <Pencil size={14} />
            {t("edit")}
          </Link>
        )}
        {running ? (
          <Link className="card-link" href={detailUrl("players")}>
            <Users size={14} />
            {t("players")}
          </Link>
        ) : (
          <button disabled title={t("serverMustBeRunning")}>
            <Users size={14} />
            {t("players")}
          </button>
        )}
        {running ? (
          <Link className="card-link" href={detailUrl("maps")}>
            <Map size={14} />
            {t("maps")}
          </Link>
        ) : (
          <button disabled title={t("serverMustBeRunning")}>
            <Map size={14} />
            {t("maps")}
          </button>
        )}
        {manage &&
          (server.updateAvailable ? (
            <button disabled title={t("updateBeforeUpload")}>
              <PackageOpen size={14} />
              {t("packages")}
            </button>
          ) : (
            <Link className="card-link" href={detailUrl("packages")}>
              <PackageOpen size={14} />
              {t("packages")}
            </Link>
          ))}
        {manageAdmins &&
          (running ? (
            <Link className="card-link" href={detailUrl("admins")}>
              <ShieldCheck size={14} />
              {t("admins")}
            </Link>
          ) : (
            <button disabled title={t("serverMustBeRunning")}>
              <ShieldCheck size={14} />
              {t("admins")}
            </button>
          ))}
        {manageBackups && server.managedBy === "panel" && (
          <Link className="card-link" href={detailUrl("backups")}>
            <Archive size={14} />
            {t("backups")}
          </Link>
        )}
        {manage && server.updateAvailable && (
          <button className="update-action" disabled={pending} onClick={onUpdate}>
            <Upload size={14} />
            {t("update")}
          </button>
        )}
        {manage && server.managedBy === "panel" && !running && (
          <button className="danger-action" disabled={pending} onClick={onRemove}>
            <Trash2 size={14} />
            {t("remove")}
          </button>
        )}
      </footer>
    </article>
  );
}
