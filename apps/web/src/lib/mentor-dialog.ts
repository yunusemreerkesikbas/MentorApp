"use client";

import {
  useDialog,
  type DialogConfirmOptions,
  type DialogInfoOptions,
  type DialogPromoOptions,
  type DialogPromoResult,
  type DialogShowOptions,
} from "@mentor/ui";
import { useTranslations } from "next-intl";
import { useCallback, useMemo, type ReactNode } from "react";
import type { PuhuVariant } from "@/components/puhu-image";
import { getDialogHero } from "./dialog-hero";
import { getDialogErrorLeading } from "./dialog-lead";

export type MentorDialogConfirmOptions = Omit<
  DialogConfirmOptions,
  "closeLabel" | "leading"
> & {
  closeLabel?: string;
  leading?: ReactNode;
};

export type MentorDialogInfoOptions = Omit<DialogInfoOptions, "closeLabel"> & {
  closeLabel?: string;
};

export type MentorDialogPromoOptions = Omit<
  DialogPromoOptions,
  "closeLabel" | "hero"
> & {
  closeLabel?: string;
  puhuVariant?: PuhuVariant;
  hero?: ReactNode;
};

export type MentorDialogShowOptions = Omit<DialogShowOptions, "closeLabel"> & {
  closeLabel?: string;
};

/** Web wrapper: injects i18n close label + Puhu/error slots for dialog presets. */
export function useMentorDialog() {
  const dialog = useDialog();
  const t = useTranslations("common.dialog");
  const closeLabel = t("close");

  const show = useCallback(
    (options: MentorDialogShowOptions) =>
      dialog.show({ ...options, closeLabel: options.closeLabel ?? closeLabel }),
    [closeLabel, dialog],
  );

  const confirm = useCallback(
    (options: MentorDialogConfirmOptions) =>
      dialog.confirm({
        ...options,
        closeLabel: options.closeLabel ?? closeLabel,
        leading: options.leading ?? getDialogErrorLeading(),
      }),
    [closeLabel, dialog],
  );

  const info = useCallback(
    (options: MentorDialogInfoOptions) =>
      dialog.info({
        ...options,
        closeLabel: options.closeLabel ?? closeLabel,
      }),
    [closeLabel, dialog],
  );

  const promo = useCallback(
    (options: MentorDialogPromoOptions): Promise<DialogPromoResult> =>
      dialog.promo({
        ...options,
        closeLabel: options.closeLabel ?? closeLabel,
        hero: options.hero ?? getDialogHero(options.puhuVariant ?? "encouraging"),
      }),
    [closeLabel, dialog],
  );

  return useMemo(
    () => ({
      dialog: dialog.dialog,
      show,
      dismiss: dialog.dismiss,
      confirm,
      info,
      promo,
    }),
    [confirm, dialog.dialog, dialog.dismiss, info, promo, show],
  );
}
