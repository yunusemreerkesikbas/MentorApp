"use client";

import {
  useToast,
  type ToastShowOptions,
  type ToastVariant,
} from "@mentor/ui";
import { useTranslations } from "next-intl";
import { useCallback, useMemo, type ReactNode } from "react";
import type { PuhuVariant } from "@/components/puhu-image";
import { getPuhuToastLeading, getToastLeading } from "./toast-lead";

export type MentorToastOptions = Omit<
  ToastShowOptions,
  "dismissLabel" | "leading"
> & {
  dismissLabel?: string;
  /** Full override — custom icon/mascot JSX. Highest priority. */
  leading?: ReactNode;
  /** Pick a Puhu PNG directly (ignored for `error` variant). */
  puhuVariant?: PuhuVariant;
};

function resolveLeading(
  options: MentorToastOptions,
  variant: ToastVariant,
): ReactNode {
  if (options.leading) return options.leading;
  if (options.puhuVariant && variant !== "error") {
    return getPuhuToastLeading(options.puhuVariant);
  }
  return getToastLeading(variant);
}

function withMentorDefaults(
  options: MentorToastOptions,
  dismissLabel: string,
): ToastShowOptions {
  const variant = options.variant ?? "info";
  return {
    ...options,
    variant,
    dismissLabel: options.dismissLabel ?? dismissLabel,
    leading: resolveLeading(options, variant),
  };
}

/** Web wrapper: injects i18n dismiss label + Puhu/error leading icons. */
export function useMentorToast() {
  const toast = useToast();
  const t = useTranslations("common.toast");
  const dismissLabel = t("dismiss");

  const show = useCallback(
    (options: MentorToastOptions) =>
      toast.show(withMentorDefaults(options, dismissLabel)),
    [dismissLabel, toast],
  );

  const variantShow = useCallback(
    (variant: ToastVariant) =>
      (options: Omit<MentorToastOptions, "variant">) =>
        show({ ...options, variant }),
    [show],
  );

  return useMemo(
    () => ({
      toasts: toast.toasts,
      show,
      dismiss: toast.dismiss,
      dismissAll: toast.dismissAll,
      success: variantShow("success"),
      error: variantShow("error"),
      info: variantShow("info"),
      coach: variantShow("coach"),
    }),
    [show, toast, variantShow],
  );
}
