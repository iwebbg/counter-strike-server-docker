"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type Toast = { id: number; message: string; error: boolean };
const ToastContext = createContext<{ success: (message: string) => void; error: (message: string) => void } | null>(
  null,
);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const show = useCallback((message: string, error: boolean) => {
    const id = Date.now();
    setItems((current) => [...current, { id, message, error }]);
    window.setTimeout(() => setItems((current) => current.filter((item) => item.id !== id)), 3500);
  }, []);
  const value = useMemo(
    () => ({ success: (message: string) => show(message, false), error: (message: string) => show(message, true) }),
    [show],
  );
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {items.map((item) => (
          <div key={item.id} className={`toast ${item.error ? "toast-error" : ""}`}>
            {item.message}
          </div>
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
