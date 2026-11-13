"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { CircleHelp, Gauge, Menu, RefreshCw, ScrollText, Server, Users, X, LogOut } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { SessionProvider, useSession } from "@/components/session-provider";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";

const items = [
  { href: "/app", key: "dashboard" as const, icon: Gauge },
  { href: "/app/servers", key: "servers" as const, icon: Server },
  { href: "/app/operators", key: "operators" as const, icon: Users, permission: "operators.manage" },
  { href: "/app/audit", key: "audit" as const, icon: ScrollText, permission: "audit.read" },
  { href: "/app/support", key: "helpSupport" as const, icon: CircleHelp },
];

function Shell({ children }: { children: ReactNode }) {
  const { locale, setLocale, t } = useI18n();
  const { user } = useSession();
  const toast = useToast();
  const pathname = usePathname();
  const router = useRouter();
  const [mobile, setMobile] = useState(false);
  const [connected, setConnected] = useState(true);
  useEffect(() => setMobile(false), [pathname]);
  useEffect(() => {
    const check = () =>
      api("/servers")
        .then(() => setConnected(true))
        .catch(() => setConnected(false));
    check();
    const timer = window.setInterval(check, 15_000);
    return () => window.clearInterval(timer);
  }, []);
  const signOut = async () => {
    try {
      await api("/v1/users/signout", { method: "POST" }, false);
      router.replace("/auth/login");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("requestFailed"));
    }
  };
  const sidebar = (
    <>
      <div className="sidebar-brand">
        <span className="brand-mark">CS</span>
        <span>
          <strong>CS 1.6 Server CP</strong>
          <small>
            {t("poweredBy")} <b>InterWeb</b>
          </small>
        </span>
      </div>
      <nav aria-label="Main navigation">
        {items
          .filter((item) => !item.permission || user?.permissions.includes(item.permission))
          .map(({ href, key, icon: Icon }) => {
            const active = pathname === href || (href !== "/app" && pathname.startsWith(`${href}/`));
            return (
              <Link key={href} href={href} className={active ? "active" : ""}>
                <Icon size={18} />
                <span>{t(key)}</span>
              </Link>
            );
          })}
      </nav>
      <div className="sidebar-status">
        <span className={connected ? "status-dot" : "status-dot offline"} />
        <span>{t(connected ? "dockerConnected" : "dockerDisconnected")}</span>
      </div>
    </>
  );
  return (
    <div className="app-shell">
      <aside className="sidebar">{sidebar}</aside>
      {mobile && (
        <div className="mobile-layer">
          <button className="mobile-backdrop" onClick={() => setMobile(false)} aria-label="Close" />
          <aside className="mobile-sidebar">
            <button className="mobile-close" onClick={() => setMobile(false)}>
              <X />
            </button>
            {sidebar}
          </aside>
        </div>
      )}
      <div className="app-main">
        <header className="app-header">
          <div className="header-left">
            <button className="icon-button menu-button" onClick={() => setMobile(true)}>
              <Menu />
            </button>
            <div>
              <small>{t("controlCenter")}</small>
              <strong>
                {items.find(
                  (item) => pathname === item.href || (item.href !== "/app" && pathname.startsWith(`${item.href}/`)),
                )
                  ? t(
                      items.find(
                        (item) =>
                          pathname === item.href || (item.href !== "/app" && pathname.startsWith(`${item.href}/`)),
                      )!.key,
                    )
                  : "CS Control"}
              </strong>
            </div>
          </div>
          <div className="header-actions">
            <span className="role-badge">{user?.role || "…"}</span>
            <select
              aria-label="Language"
              value={locale}
              onChange={(e) => setLocale(e.target.value === "en" ? "en" : "bg")}
            >
              <option value="bg">BG</option>
              <option value="en">EN</option>
            </select>
            <button className="icon-button" onClick={() => window.location.reload()} title={t("refresh")}>
              <RefreshCw size={17} />
            </button>
            <button className="button ghost signout" onClick={signOut}>
              <LogOut size={16} />
              <span>{t("signOut")}</span>
            </button>
          </div>
        </header>
        <main className="page-container">{children}</main>
        <footer className="app-footer">
          <span>
            CS 1.6 Server CP · {t("poweredBy")}{" "}
            <a href="https://interweb.bg" target="_blank" rel="noreferrer">
              InterWeb
            </a>
          </span>
          <Link href="/app/support">{t("helpSupport")}</Link>
        </footer>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <Shell>{children}</Shell>
    </SessionProvider>
  );
}
