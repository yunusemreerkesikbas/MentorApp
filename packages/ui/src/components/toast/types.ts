import type * as React from "react";

export type ToastVariant = "success" | "error" | "info" | "coach";

export interface ToastShowOptions {
  title: string;
  message?: string;
  variant?: ToastVariant;
  /** Auto-dismiss duration in ms. Default 5000. 0 = manual dismiss only. */
  duration?: number;
  /** Overrides variant default leading content (e.g. Puhu mascot from web). */
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
  info: (options: Omit<ToastShowOptions, "variant">) => string;
  coach: (options: Omit<ToastShowOptions, "variant">) => string;
}

export const TOAST_MAX_STACK = 3;
export const TOAST_DEFAULT_DURATION = 5000;
export const TOAST_EXIT_MS = 200;
