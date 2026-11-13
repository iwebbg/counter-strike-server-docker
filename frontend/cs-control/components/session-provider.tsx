"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import type { SessionUser } from "@/lib/types";

type SessionContextValue = { user: SessionUser | null; loading: boolean; reload: () => Promise<void> };
const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const reload = async () => {
    try {
      const session = await api<{ user: SessionUser }>("/v1/users/session", {}, false);
      setUser(session.user);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    reload().catch(() => setLoading(false));
  }, []);
  return <SessionContext.Provider value={{ user, loading, reload }}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error("SessionProvider is missing");
  return context;
}
