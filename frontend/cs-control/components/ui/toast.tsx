"use client";

import { AlertTriangle, CheckCircle2, CircleX, Info, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type ToastVariant = "success" | "error" | "warning" | "info";
type ToastInput = {
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
};
type ToastItem = ToastInput & {
  id: string;
  variant: ToastVariant;
  duration: number;
};
type ToastApi = {
  show: (input: ToastInput) => string;
  success: (title: string, description?: string) => string;
  error: (title: string, description?: string) => string;
  warning: (title: string, description?: string) => string;
  info: (title: string, description?: string) => string;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);
const icons = {
  success: CheckCircle2,
  error: CircleX,
  warning: AlertTriangle,
  info: Info,
};

function VisibleToast({ item, dismiss }: { item: ToastItem; dismiss: (id: string) => void }) {
  const Icon = icons[item.variant];

  useEffect(() => {
    const timer = window.setTimeout(() => dismiss(item.id), item.duration);
    return () => window.clearTimeout(timer);
  }, [dismiss, item.duration, item.id]);

  return (
    <article
      className={`toast toast-${item.variant}`}
      role={item.variant === "error" ? "alert" : "status"}
      aria-atomic="true"
    >
      <span className="toast-tone" aria-hidden="true" />
      <span className="toast-icon" aria-hidden="true">
        <Icon size={19} strokeWidth={2.2} />
      </span>
      <span className="toast-copy">
        <strong>{item.title}</strong>
        {item.description ? <small>{item.description}</small> : null}
      </span>
      <button
        className="toast-dismiss"
        type="button"
        onClick={() => dismiss(item.id)}
        aria-label="Dismiss notification"
      >
        <X size={16} />
      </button>
    </article>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const dismiss = useCallback((id: string) => setItems((current) => current.filter((item) => item.id !== id)), []);
  const show = useCallback((input: ToastInput) => {
    const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
    const item: ToastItem = {
      ...input,
      id,
      variant: input.variant ?? "info",
      duration: input.duration ?? (input.variant === "error" ? 7000 : 4500),
    };
    setItems((current) =>
      current.some(
        (existing) =>
          existing.title === item.title &&
          existing.description === item.description &&
          existing.variant === item.variant,
      )
        ? current
        : [...current.slice(-3), item],
    );
    return id;
  }, []);
  const value = useMemo<ToastApi>(
    () => ({
      show,
      success: (title, description) => show({ title, description, variant: "success" }),
      error: (title, description) => show({ title, description, variant: "error" }),
      warning: (title, description) => show({ title, description, variant: "warning" }),
      info: (title, description) => show({ title, description, variant: "info" }),
      dismiss,
    }),
    [dismiss, show],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-atomic="false">
        {items.map((item) => (
          <VisibleToast key={item.id} item={item} dismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("ToastProvider is missing");
  return context;
}
