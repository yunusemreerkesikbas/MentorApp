import type * as React from "react";

/**
 * Status of the thing that just happened — not a mood. `warning` covers refusals that are not
 * failures (a limit reached, an unsupported file): red would overstate them and the product tone
 * is anti-shaming (AGENTS.md §0). The former `coach` variant is gone — it had zero call sites.
 */
export type ToastVariant = "success" | "error" | "warning" | "info";

export interface ToastShowOptions {
  title: string;
  message?: string;
  variant?: ToastVariant;
  /** Auto-dismiss duration in ms. Default 5000. 0 = manual dismiss only. */
  duration?: number;
  /** Overrides the variant default leading content (web supplies the status icon). */
  leading?: React.ReactNode;
  /** Localized dismiss button label for screen readers. */
  dismissLabel: string;
  /** Optional id for dedupe/replace. */
  id?: string;
  /**
   * One thing the toast lets you do about what it just told you.
   *
   * Singular on purpose: a toast is a passing remark, and a remark with two buttons is a dialog
   * that forgot to block. Pressing it dismisses the toast — the toast has said its piece.
   */
  action?: { label: string; onClick: () => void };
}

export interface ToastRecord extends Required<
  Pick<ToastShowOptions, "title" | "dismissLabel">
> {
  id: string;
  message?: string;
  variant: ToastVariant;
  duration: number;
  leading?: React.ReactNode;
  action?: { label: string; onClick: () => void };
  /** Set when exit animation starts. */
  exiting?: boolean;
  createdAt: number;
}

export interface ToastContextValue {
  toasts: ToastRecord[];
  show: (options: ToastShowOptions) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
  success: (options: Omit<ToastShowOptions, "variant">) => string;
  error: (options: Omit<ToastShowOptions, "variant">) => string;
  warning: (options: Omit<ToastShowOptions, "variant">) => string;
  info: (options: Omit<ToastShowOptions, "variant">) => string;
}

export const TOAST_MAX_STACK = 3;
export const TOAST_DEFAULT_DURATION = 5000;
export const TOAST_EXIT_MS = 200;
