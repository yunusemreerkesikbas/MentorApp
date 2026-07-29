"use client";

import type * as React from "react";
import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ToastViewport } from "./toast-viewport.js";
import {
  TOAST_DEFAULT_DURATION,
  TOAST_EXIT_MS,
  TOAST_MAX_STACK,
  type ToastContextValue,
  type ToastRecord,
  type ToastShowOptions,
} from "./types.js";

export const ToastContext = createContext<ToastContextValue | null>(null);

function createToastId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export interface ToastProviderProps {
  children: React.ReactNode;
  /** Injected by apps/web to map variants → Puhu / error icon. */
  renderLeading?: (variant: ToastRecord["variant"]) => React.ReactNode;
}

export function ToastProvider({ children, renderLeading }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  const exitTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  const clearTimer = useCallback((id: string) => {
    const t = timersRef.current.get(id);
    if (t) {
      clearTimeout(t);
      timersRef.current.delete(id);
    }
  }, []);

  const clearExitTimer = useCallback((id: string) => {
    const t = exitTimersRef.current.get(id);
    if (t) {
      clearTimeout(t);
      exitTimersRef.current.delete(id);
    }
  }, []);

  const removeToast = useCallback(
    (id: string) => {
      clearTimer(id);
      clearExitTimer(id);
      setToasts((prev) => prev.filter((t) => t.id !== id));
    },
    [clearExitTimer, clearTimer],
  );

  const dismiss = useCallback(
    (id: string) => {
      clearTimer(id);
      setToasts((prev) => {
        const target = prev.find((t) => t.id === id);
        if (!target || target.exiting) return prev;
        return prev.map((t) => (t.id === id ? { ...t, exiting: true } : t));
      });
      clearExitTimer(id);
      const exitTimer = setTimeout(() => removeToast(id), TOAST_EXIT_MS);
      exitTimersRef.current.set(id, exitTimer);
    },
    [clearExitTimer, clearTimer, removeToast],
  );

  const scheduleAutoDismiss = useCallback(
    (id: string, duration: number) => {
      if (duration <= 0) return;
      clearTimer(id);
      const timer = setTimeout(() => dismiss(id), duration);
      timersRef.current.set(id, timer);
    },
    [clearTimer, dismiss],
  );

  const show = useCallback(
    (options: ToastShowOptions): string => {
      const id = options.id ?? createToastId();
      const duration = options.duration ?? TOAST_DEFAULT_DURATION;
      const record: ToastRecord = {
        id,
        title: options.title,
        message: options.message,
        variant: options.variant ?? "info",
        duration,
        leading: options.leading,
        dismissLabel: options.dismissLabel,
        createdAt: Date.now(),
      };

      setToasts((prev) => {
        const withoutDup = prev.filter((t) => t.id !== id);
        const next = [record, ...withoutDup].slice(0, TOAST_MAX_STACK);
        const dropped = [record, ...withoutDup].slice(TOAST_MAX_STACK);
        for (const droppedToast of dropped) {
          clearTimer(droppedToast.id);
          clearExitTimer(droppedToast.id);
        }
        return next;
      });

      scheduleAutoDismiss(id, duration);
      return id;
    },
    [clearExitTimer, clearTimer, scheduleAutoDismiss],
  );

  const dismissAll = useCallback(() => {
    for (const id of timersRef.current.keys()) clearTimer(id);
    for (const id of exitTimersRef.current.keys()) clearExitTimer(id);
    setToasts([]);
  }, [clearExitTimer, clearTimer]);

  const success = useCallback(
    (options: Omit<ToastShowOptions, "variant">) =>
      show({ ...options, variant: "success" }),
    [show],
  );

  const error = useCallback(
    (options: Omit<ToastShowOptions, "variant">) =>
      show({ ...options, variant: "error" }),
    [show],
  );

  const info = useCallback(
    (options: Omit<ToastShowOptions, "variant">) =>
      show({ ...options, variant: "info" }),
    [show],
  );

  const coach = useCallback(
    (options: Omit<ToastShowOptions, "variant">) =>
      show({ ...options, variant: "coach" }),
    [show],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      toasts,
      show,
      dismiss,
      dismissAll,
      success,
      error,
      info,
      coach,
    }),
    [coach, dismiss, dismissAll, error, info, show, success, toasts],
  );

  useEffect(() => {
    const timers = timersRef.current;
    const exitTimers = exitTimersRef.current;
    return () => {
      for (const t of timers.values()) clearTimeout(t);
      for (const t of exitTimers.values()) clearTimeout(t);
      timers.clear();
      exitTimers.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport
        toasts={toasts}
        onDismiss={dismiss}
        renderLeading={renderLeading}
      />
    </ToastContext.Provider>
  );
}
