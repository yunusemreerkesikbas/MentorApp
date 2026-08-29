"use client";

import {
  useToast,
  type ToastShowOptions,
  type ToastVariant,
} from "@mentor/ui";
import { useTranslations } from "next-intl";
import { useCallback, useMemo, type ReactNode } from "react";
import { getToastLeading } from "./toast-lead";

export type MentorToastOptions = Omit<
  ToastShowOptions,
  "dismissLabel" | "leading"
> & {
  dismissLabel?: string;
  /** Full override — custom leading JSX. Highest priority. */
  leading?: ReactNode;
};

function resolveLeading(
  options: MentorToastOptions,
  variant: ToastVariant,
): ReactNode {
  return options.leading ?? getToastLeading(variant);
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

/** Web wrapper: injects the i18n dismiss label + the variant status icon. */
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
      warning: variantShow("warning"),
      info: variantShow("info"),
    }),
    [show, toast, variantShow],
  );
}
