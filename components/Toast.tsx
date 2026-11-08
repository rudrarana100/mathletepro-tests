"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "info";

interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, type: ToastType = "info") => {
      const id = `${Date.now()}_${Math.random()}`;
      setToasts((prev) => [...prev, { id, message, type }]);

      setTimeout(() => {
        removeToast(id);
      }, 4000);
    },
    [removeToast]
  );

  const success = useCallback((msg: string) => toast(msg, "success"), [toast]);
  const error = useCallback((msg: string) => toast(msg, "error"), [toast]);
  const info = useCallback((msg: string) => toast(msg, "info"), [toast]);

  return (
    <ToastContext.Provider value={{ toast, success, error, info }}>
      {children}
      {/* Toast container floating at bottom-right */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none p-2 sm:p-0">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto p-3.5 border rounded-lg shadow-xl flex items-start gap-3 animate-in slide-in-from-bottom-2 duration-150 ${
              t.type === "success"
                ? "bg-zinc-950 border-emerald-500/30 text-emerald-300"
                : t.type === "error"
                ? "bg-zinc-950 border-red-500/30 text-red-300"
                : "bg-zinc-950 border-zinc-800 text-zinc-200"
            }`}
          >
            {t.type === "success" && (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            )}
            {t.type === "error" && (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            )}
            {t.type === "info" && (
              <Info className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
            )}

            <div className="flex-1 text-sm font-normal leading-snug">{t.message}</div>

            <button
              onClick={() => removeToast(t.id)}
              className="text-zinc-500 hover:text-white shrink-0 -mr-1 -mt-0.5 p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    return {
      toast: (msg: string) => console.log("[Toast]", msg),
      success: (msg: string) => console.log("[Success]", msg),
      error: (msg: string) => console.error("[Error]", msg),
      info: (msg: string) => console.log("[Info]", msg),
    };
  }
  return context;
}
