export type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T;
  error_code?: string;
  extensions?: Array<{ field?: string; error_code?: string }>;
};

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, payload: Partial<ApiEnvelope<unknown>>) {
    super(payload.message || payload.error_code || "REQUEST_FAILED");
    this.name = "ApiError";
    this.status = status;
    this.code = payload.error_code || payload.message || "REQUEST_FAILED";
  }
}

let refreshPromise: Promise<boolean> | null = null;
let redirecting = false;

async function send(path: string, init: RequestInit) {
  return fetch(`/api${path}`, {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(init.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
}

async function refreshSession() {
  if (refreshPromise) return refreshPromise;
  refreshPromise = send("/v1/users/session/refresh", { method: "POST" })
    .then(async (response) => response.ok && (await response.json().catch(() => null))?.success === true)
    .catch(() => false)
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

function redirectToLogin() {
  if (typeof window === "undefined" || redirecting || window.location.pathname === "/auth/login") return;
  redirecting = true;
  const current = `${window.location.pathname}${window.location.search}`;
  window.location.assign(`/auth/login?redirect=${encodeURIComponent(current)}`);
}

export async function api<T>(path: string, init: RequestInit = {}, allowRefresh = true): Promise<T> {
  let response = await send(path, init);
  if (response.status === 401 && allowRefresh && !path.startsWith("/v1/users/")) {
    if (await refreshSession()) response = await send(path, init);
    else redirectToLogin();
  }
  const payload = (await response.json().catch(() => ({}))) as Partial<ApiEnvelope<T>>;
  if (!response.ok || payload.success !== true) {
    if (response.status === 401 && allowRefresh) redirectToLogin();
    throw new ApiError(response.status, payload);
  }
  return payload.data as T;
}
