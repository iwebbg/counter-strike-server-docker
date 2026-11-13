"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { ServersPayload } from "@/lib/types";

export function useServers(poll = true) {
  const [data, setData] = useState<ServersPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const reload = useCallback(async () => {
    try {
      setData(await api<ServersPayload>("/servers"));
      setError("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "REQUEST_FAILED");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    reload();
    if (!poll) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) reload();
    }, 7000);
    return () => window.clearInterval(timer);
  }, [poll, reload]);
  return { data, loading, error, reload };
}
