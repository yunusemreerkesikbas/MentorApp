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
import { BottomSheetViewport } from "./bottom-sheet-viewport.js";
import {
  BOTTOM_SHEET_EXIT_MS,
  type BottomSheetActionResult,
  type BottomSheetActionSheetOptions,
  type BottomSheetContextValue,
  type BottomSheetFilterOptions,
  type BottomSheetRecord,
  type BottomSheetShowOptions,
} from "./types.js";

export const BottomSheetContext = createContext<BottomSheetContextValue | null>(
  null,
);

function createSheetId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `sheet-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

type PendingResolver =
  | { kind: "action"; resolve: (value: BottomSheetActionResult) => void }
  | { kind: "filter"; resolve: (value: "apply" | "cancel") => void };

export interface BottomSheetProviderProps {
  children: React.ReactNode;
}

export function BottomSheetProvider({ children }: BottomSheetProviderProps) {
  const [sheet, setSheet] = useState<BottomSheetRecord | null>(null);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<PendingResolver | null>(null);
  const sheetRef = useRef<BottomSheetRecord | null>(null);

  sheetRef.current = sheet;

  const resolvePending = useCallback(
    (value: BottomSheetActionResult | "apply" | "cancel") => {
      const pending = pendingRef.current;
      if (!pending) return;
      pendingRef.current = null;
      if (pending.kind === "action") {
        pending.resolve(value as BottomSheetActionResult);
      } else {
        pending.resolve(value as "apply" | "cancel");
      }
    },
    [],
  );

  const abortPending = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;
    if (pending.kind === "action") pending.resolve("cancel");
    else pending.resolve("cancel");
  }, []);

  const removeSheet = useCallback(() => {
    setSheet(null);
  }, []);

  const finishDismiss = useCallback(
    (result: BottomSheetActionResult | "apply" | "cancel" | "default") => {
      const current = sheetRef.current;
      if (!current || current.exiting) return;

      setSheet({ ...current, exiting: true, busyApply: false });
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
      exitTimerRef.current = setTimeout(() => {
        removeSheet();
        if (result === "default") {
          const pending = pendingRef.current;
          if (pending?.kind === "action") resolvePending("cancel");
          else if (pending?.kind === "filter") resolvePending("cancel");
          else pendingRef.current = null;
        } else {
          resolvePending(result);
        }
      }, BOTTOM_SHEET_EXIT_MS);
    },
    [removeSheet, resolvePending],
  );

  const dismiss = useCallback(() => {
    finishDismiss("default");
  }, [finishDismiss]);

  const dismissNow = useCallback(() => {
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    removeSheet();
    resolvePending("cancel");
  }, [removeSheet, resolvePending]);

  const openSheet = useCallback((options: BottomSheetShowOptions) => {
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    setSheet({
      id: createSheetId(),
      title: options.title,
      layout: options.layout ?? "action",
      actions: options.actions,
      cancelLabel: options.cancelLabel,
      applyLabel: options.applyLabel,
      closeLabel: options.closeLabel,
      children: options.children,
      bodyScroll: options.bodyScroll,
      dismissOnBackdrop: options.dismissOnBackdrop ?? true,
      dismissOnEscape: options.dismissOnEscape ?? true,
      onApply: options.onApply,
    });
  }, []);

  const show = useCallback(
    (options: BottomSheetShowOptions) => {
      abortPending();
      openSheet(options);
    },
    [abortPending, openSheet],
  );

  const handleActionSelect = useCallback(
    (actionId: string) => {
      finishDismiss(actionId);
    },
    [finishDismiss],
  );

  const handleCancel = useCallback(() => {
    finishDismiss("cancel");
  }, [finishDismiss]);

  const handleClose = useCallback(() => {
    finishDismiss("cancel");
  }, [finishDismiss]);

  const handleApply = useCallback(async () => {
    const current = sheetRef.current;
    if (!current || current.exiting || current.busyApply) return;

    if (current.onApply) {
      setSheet({ ...current, busyApply: true });
      try {
        await current.onApply();
      } finally {
        if (sheetRef.current && !sheetRef.current.exiting) {
          setSheet({ ...sheetRef.current, busyApply: false });
        }
      }
      if (sheetRef.current?.exiting) return;
    }

    finishDismiss("apply");
  }, [finishDismiss]);

  const handleBackdropClick = useCallback(() => {
    const current = sheetRef.current;
    if (!current?.dismissOnBackdrop || current.busyApply) return;
    dismiss();
  }, [dismiss]);

  const actionSheet = useCallback(
    (
      options: BottomSheetActionSheetOptions,
    ): Promise<BottomSheetActionResult> => {
      abortPending();
      return new Promise((resolve) => {
        pendingRef.current = { kind: "action", resolve };
        openSheet({
          title: options.title,
          layout: "action",
          actions: options.actions,
          cancelLabel: options.cancelLabel,
          closeLabel: options.closeLabel,
          dismissOnBackdrop: true,
          dismissOnEscape: true,
        });
      });
    },
    [abortPending, openSheet],
  );

  const filterSheet = useCallback(
    (options: BottomSheetFilterOptions): Promise<"apply" | "cancel"> => {
      abortPending();
      return new Promise((resolve) => {
        pendingRef.current = { kind: "filter", resolve };
        openSheet({
          title: options.title,
          layout: "filter",
          applyLabel: options.applyLabel,
          closeLabel: options.closeLabel,
          children: options.children,
          onApply: options.onApply,
          dismissOnBackdrop: true,
          dismissOnEscape: true,
        });
      });
    },
    [abortPending, openSheet],
  );

  useEffect(() => {
    if (!sheet || sheet.exiting) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const current = sheetRef.current;
      if (!current?.dismissOnEscape || current.busyApply) return;
      event.preventDefault();
      dismiss();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [sheet, dismiss]);

  useEffect(() => {
    if (!sheet || sheet.exiting) return;
    const frame = requestAnimationFrame(() => {
      const panel = document.querySelector("[data-mentor-bottom-sheet-panel]");
      const focusable = panel?.querySelector<HTMLElement>(
        'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      );
      focusable?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [sheet?.id, sheet?.exiting]);

  useEffect(() => {
    return () => {
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    };
  }, []);

  const value = useMemo<BottomSheetContextValue>(
    () => ({
      sheet,
      show,
      dismiss,
      dismissNow,
      actionSheet,
      filterSheet,
    }),
    [actionSheet, dismiss, dismissNow, filterSheet, sheet, show],
  );

  const closeLabel = sheet?.closeLabel ?? "";

  return (
    <BottomSheetContext.Provider value={value}>
      {children}
      <BottomSheetViewport
        sheet={sheet}
        closeLabel={closeLabel}
        onBackdropClick={handleBackdropClick}
        onActionSelect={handleActionSelect}
        onCancel={handleCancel}
        onApply={() => void handleApply()}
        onClose={handleClose}
      />
    </BottomSheetContext.Provider>
  );
}
