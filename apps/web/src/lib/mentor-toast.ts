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

/** Web wrapper: injects the i18n dismiss label + the variant status icon.
 *  `error`/`show` stay stable across stack updates; do not put the returned object in effect deps. */
export function useMentorToast() {
  const toast = useToast();
  const t = useTranslations("common.toast");
  const dismissLabel = t("dismiss");
  const { show: pushToast, dismiss, dismissAll, toasts } = toast;

  const show = useCallback(
    (options: MentorToastOptions) =>
      pushToast(withMentorDefaults(options, dismissLabel)),
    [dismissLabel, pushToast],
  );

  const success = useCallback(
    (options: Omit<MentorToastOptions, "variant">) =>
      show({ ...options, variant: "success" }),
    [show],
  );
  const error = useCallback(
    (options: Omit<MentorToastOptions, "variant">) =>
      show({ ...options, variant: "error" }),
    [show],
  );
  const warning = useCallback(
    (options: Omit<MentorToastOptions, "variant">) =>
      show({ ...options, variant: "warning" }),
    [show],
  );
  const info = useCallback(
    (options: Omit<MentorToastOptions, "variant">) =>
      show({ ...options, variant: "info" }),
    [show],
  );

  return useMemo(
    () => ({
      toasts,
      show,
      dismiss,
      dismissAll,
      success,
      error,
      warning,
      info,
    }),
    [dismiss, dismissAll, error, info, show, success, toasts, warning],
  );
}
