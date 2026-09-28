import type * as React from "react";

export type DialogLayout = "standard" | "promo";

/** `danger` = the red ledge of an irreversible confirm; `link` = a text action ("Vazgeç"). */
export type DialogActionVariant = "primary" | "secondary" | "danger" | "link";

export interface DialogAction {
  id: string;
  label: string;
  variant: DialogActionVariant;
  onClick?: () => void | Promise<void>;
  href?: string;
  busy?: boolean;
}

export interface DialogShowOptions {
  title: string;
  message?: string;
  content?: React.ReactNode;
  layout?: DialogLayout;
  hero?: React.ReactNode;
  leading?: React.ReactNode;
  badge?: string;
  actions: DialogAction[];
  dismissOnBackdrop?: boolean;
  dismissOnEscape?: boolean;
  closeLabel: string;
}

export interface DialogRecord extends DialogShowOptions {
  id: string;
  layout: DialogLayout;
  exiting?: boolean;
  busyActionId?: string;
}

export interface DialogConfirmOptions {
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel: string;
  closeLabel: string;
  leading?: React.ReactNode;
  /** Irreversible (end a link, delete): the confirm turns danger red and focus starts on cancel. */
  destructive?: boolean;
}

export interface DialogInfoOptions {
  title: string;
  message?: string;
  okLabel: string;
  closeLabel: string;
}

export interface DialogPromoOptions {
  title: string;
  message?: string;
  badge?: string;
  primaryLabel: string;
  linkLabel?: string;
  closeLabel: string;
  hero?: React.ReactNode;
}

export type DialogPromoResult = "primary" | "link" | "dismiss";

export interface DialogContextValue {
  dialog: DialogRecord | null;
  show: (options: DialogShowOptions) => void;
  dismiss: () => void;
  confirm: (options: DialogConfirmOptions) => Promise<boolean>;
  info: (options: DialogInfoOptions) => Promise<void>;
  promo: (options: DialogPromoOptions) => Promise<DialogPromoResult>;
}

export const DIALOG_EXIT_MS = 150;
