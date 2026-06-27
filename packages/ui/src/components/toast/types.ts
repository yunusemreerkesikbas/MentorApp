import type { ReactNode } from "react";

export type ToastVariant = "success" | "error" | "info" | "coach";

export interface ToastShowOptions {
  title: string;
  message?: string;
  variant?: ToastVariant;
  /** Auto-dismiss duration in ms. Default 5000. 0 = manual dismiss only. */
  duration?: number;
  /** Overrides variant default leading content (e.g. Puhu mascot from web). */
  leading?: ReactNode;
  /** Localized dismiss button label for screen readers. */
  dismissLabel: string;
  /** Optional id for dedupe/replace. */
  id?: string;
}

export interface ToastRecord extends Required<Pick<ToastShowOptions, "title" | "dismissLabel">> {
  id: string;
  message?: string;
  variant: ToastVariant;
  duration: number;
  leading?: ReactNode;
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
