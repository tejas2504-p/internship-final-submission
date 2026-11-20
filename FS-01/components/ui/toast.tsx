"use client";

import * as React from "react";
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from "lucide-react";

export type ToastVariant = "default" | "success" | "error" | "warning";

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

interface ToastContextType {
  toasts: ToastItem[];
  toast: (options: Omit<ToastItem, "id">) => string;
  addToast: (
    titleOrOptions: string | Omit<ToastItem, "id">,
    variant?: ToastVariant
  ) => string;
  dismissToast: (id: string) => void;
  success: (title: string, description?: string) => string;
  error: (title: string, description?: string) => string;
  warning: (title: string, description?: string) => string;
  info: (title: string, description?: string) => string;
}

const ToastContext = React.createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  const dismissToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = React.useCallback(
    (options: Omit<ToastItem, "id">) => {
      const id = Math.random().toString(36).slice(2, 9);
      const duration = options.duration ?? 4000;
      const newToast: ToastItem = { ...options, id };

      setToasts((prev) => [...prev.slice(-4), newToast]); // keep max 5 toasts

      if (duration > 0) {
        setTimeout(() => {
          dismissToast(id);
        }, duration);
      }

      return id;
    },
    [dismissToast]
  );

  const addToast = React.useCallback(
    (
      titleOrOptions: string | Omit<ToastItem, "id">,
      variant?: ToastVariant
    ) => {
      if (typeof titleOrOptions === "string") {
        return toast({ title: titleOrOptions, variant });
      }
      return toast(titleOrOptions);
    },
    [toast]
  );

  const success = React.useCallback(
    (title: string, description?: string) =>
      toast({ title, description, variant: "success" }),
    [toast]
  );

  const error = React.useCallback(
    (title: string, description?: string) =>
      toast({ title, description, variant: "error" }),
    [toast]
  );

  const warning = React.useCallback(
    (title: string, description?: string) =>
      toast({ title, description, variant: "warning" }),
    [toast]
  );

  const info = React.useCallback(
    (title: string, description?: string) =>
      toast({ title, description, variant: "default" }),
    [toast]
  );

  return (
    <ToastContext.Provider
      value={{
        toasts,
        toast,
        addToast,
        dismissToast,
        success,
        error,
        warning,
        info,
      }}
    >
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none p-2 sm:p-0"
    >
      {toasts.map((item) => (
        <ToastCard key={item.id} item={item} onDismiss={() => onDismiss(item.id)} />
      ))}
    </div>
  );
}

function ToastCard({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: () => void;
}) {
  const variant = item.variant || "default";

  const icons = {
    default: <Info className="w-4 h-4 text-indigo-500 shrink-0" />,
    success: <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />,
    error: <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />,
    warning: <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />,
  };

  const borders = {
    default: "border-indigo-100 dark:border-indigo-950/50 bg-white dark:bg-white",
    success: "border-emerald-100 dark:border-emerald-950/50 bg-white dark:bg-white",
    error: "border-rose-100 dark:border-rose-950/50 bg-white dark:bg-white",
    warning: "border-amber-100 dark:border-amber-950/50 bg-white dark:bg-white",
  };

  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-2xl border shadow-xl shadow-slate-900/10 backdrop-blur-md transition-all duration-200 animate-in slide-in-from-bottom-3 ${borders[variant]}`}
    >
      <div className="mt-0.5">{icons[variant]}</div>
      <div className="flex-1 min-w-0">
        <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-900 leading-snug">
          {item.title}
        </h4>
        {item.description && (
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
            {item.description}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        aria-label="Dismiss notification"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

