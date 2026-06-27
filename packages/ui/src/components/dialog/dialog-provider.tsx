"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { DialogViewport } from "./dialog-viewport.js";
import {
  DIALOG_EXIT_MS,
  type DialogConfirmOptions,
  type DialogContextValue,
  type DialogInfoOptions,
  type DialogPromoOptions,
  type DialogPromoResult,
  type DialogRecord,
  type DialogShowOptions,
} from "./types.js";

export const DialogContext = createContext<DialogContextValue | null>(null);

function createDialogId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `dialog-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

type PendingResolver =
  | { kind: "boolean"; resolve: (value: boolean) => void }
  | { kind: "void"; resolve: () => void }
  | { kind: "promo"; resolve: (value: DialogPromoResult) => void };

export interface DialogProviderProps {
  children: ReactNode;
}

export function DialogProvider({ children }: DialogProviderProps) {
  const [dialog, setDialog] = useState<DialogRecord | null>(null);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<PendingResolver | null>(null);
  const dialogRef = useRef<DialogRecord | null>(null);

  dialogRef.current = dialog;

  const resolvePending = useCallback((value: boolean | void | DialogPromoResult) => {
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;
    if (pending.kind === "boolean") pending.resolve(value as boolean);
    else if (pending.kind === "void") pending.resolve();
    else pending.resolve(value as DialogPromoResult);
  }, []);

  const abortPending = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;
    if (pending.kind === "boolean") pending.resolve(false);
    else if (pending.kind === "void") pending.resolve();
    else pending.resolve("dismiss");
  }, []);

  const removeDialog = useCallback(() => {
    setDialog(null);
  }, []);

  const finishDismiss = useCallback(
    (result: boolean | void | DialogPromoResult | "default") => {
      const current = dialogRef.current;
      if (!current || current.exiting) return;

      setDialog({ ...current, exiting: true, busyActionId: undefined });
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
      exitTimerRef.current = setTimeout(() => {
        removeDialog();
        if (result === "default") {
          const pending = pendingRef.current;
          if (pending?.kind === "boolean") resolvePending(false);
          else if (pending?.kind === "void") resolvePending(undefined);
          else if (pending?.kind === "promo") resolvePending("dismiss");
          else pendingRef.current = null;
        } else {
          resolvePending(result);
        }
      }, DIALOG_EXIT_MS);
    },
    [removeDialog, resolvePending],
  );

  const dismiss = useCallback(() => {
    finishDismiss("default");
  }, [finishDismiss]);

  const openDialog = useCallback((options: DialogShowOptions) => {
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    setDialog({
      id: createDialogId(),
      title: options.title,
      message: options.message,
      content: options.content,
      layout: options.layout ?? "standard",
      hero: options.hero,
      leading: options.leading,
      badge: options.badge,
      actions: options.actions,
      dismissOnBackdrop: options.dismissOnBackdrop ?? true,
      dismissOnEscape: options.dismissOnEscape ?? true,
      closeLabel: options.closeLabel,
    });
  }, []);

  const show = useCallback(
    (options: DialogShowOptions) => {
      abortPending();
      openDialog(options);
    },
    [abortPending, openDialog],
  );

  const handleAction = useCallback(
    async (actionId: string) => {
      const current = dialogRef.current;
      if (!current || current.exiting || current.busyActionId) return;

      const action = current.actions.find((a) => a.id === actionId);
      if (!action) return;

      if (action.onClick) {
        setDialog({ ...current, busyActionId: actionId });
        await action.onClick();
        if (!dialogRef.current || dialogRef.current.exiting) return;
      }

      const pending = pendingRef.current;
      if (pending?.kind === "boolean") {
        finishDismiss(actionId === "confirm");
        return;
      }
      if (pending?.kind === "void" && actionId === "ok") {
        finishDismiss(undefined);
        return;
      }
      if (pending?.kind === "promo") {
        if (actionId === "primary") finishDismiss("primary");
        else if (actionId === "link") finishDismiss("link");
        return;
      }

      dismiss();
    },
    [dismiss, finishDismiss],
  );

  const handleBackdropClick = useCallback(() => {
    const current = dialogRef.current;
    if (!current?.dismissOnBackdrop || current.busyActionId) return;
    dismiss();
  }, [dismiss]);

  const confirm = useCallback(
    (options: DialogConfirmOptions): Promise<boolean> => {
      abortPending();
      return new Promise((resolve) => {
        pendingRef.current = { kind: "boolean", resolve };
        openDialog({
          title: options.title,
          message: options.message,
          layout: "standard",
          leading: options.leading,
          closeLabel: options.closeLabel,
          dismissOnBackdrop: false,
          dismissOnEscape: true,
          actions: [
            {
              id: "confirm",
              label: options.confirmLabel,
              variant: "primary",
            },
            {
              id: "cancel",
              label: options.cancelLabel,
              variant: "secondary",
            },
          ],
        });
      });
    },
    [abortPending, openDialog],
  );

  const info = useCallback(
    (options: DialogInfoOptions): Promise<void> => {
      abortPending();
      return new Promise((resolve) => {
        pendingRef.current = { kind: "void", resolve };
        openDialog({
          title: options.title,
          message: options.message,
          layout: "standard",
          closeLabel: options.closeLabel,
          dismissOnBackdrop: true,
          dismissOnEscape: true,
          actions: [
            {
              id: "ok",
              label: options.okLabel,
              variant: "primary",
            },
          ],
        });
      });
    },
    [abortPending, openDialog],
  );

  const promo = useCallback(
    (options: DialogPromoOptions): Promise<DialogPromoResult> => {
      abortPending();
      return new Promise((resolve) => {
        pendingRef.current = { kind: "promo", resolve };
        const actions: DialogShowOptions["actions"] = [
          {
            id: "primary",
            label: options.primaryLabel,
            variant: "primary",
          },
        ];
        if (options.linkLabel) {
          actions.push({
            id: "link",
            label: options.linkLabel,
            variant: "link",
          });
        }
        openDialog({
          title: options.title,
          message: options.message,
          layout: "promo",
          hero: options.hero,
          badge: options.badge,
          closeLabel: options.closeLabel,
          dismissOnBackdrop: true,
          dismissOnEscape: true,
          actions,
        });
      });
    },
    [abortPending, openDialog],
  );

  useEffect(() => {
    if (!dialog || dialog.exiting) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const current = dialogRef.current;
      if (!current?.dismissOnEscape || current.busyActionId) return;
      event.preventDefault();
      dismiss();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dialog, dismiss]);

  useEffect(() => {
    if (!dialog || dialog.exiting) return;
    const frame = requestAnimationFrame(() => {
      const panel = document.querySelector("[data-mentor-dialog-panel]");
      const focusable = panel?.querySelector<HTMLElement>(
        'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      );
      focusable?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [dialog?.id, dialog?.exiting]);

  useEffect(() => {
    return () => {
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    };
  }, []);

  const value = useMemo<DialogContextValue>(
    () => ({
      dialog,
      show,
      dismiss,
      confirm,
      info,
      promo,
    }),
    [confirm, dialog, dismiss, info, promo, show],
  );

  const closeLabel = dialog?.closeLabel ?? "";

  return (
    <DialogContext.Provider value={value}>
      {children}
      <DialogViewport
        dialog={dialog}
        closeLabel={closeLabel}
        onBackdropClick={handleBackdropClick}
        onAction={handleAction}
      />
    </DialogContext.Provider>
  );
}
