"use client";

import {
  useBottomSheet,
  type BottomSheetActionSheetOptions,
  type BottomSheetFilterOptions,
  type BottomSheetShowOptions,
} from "@mentor/ui";
import { NextIntlClientProvider, useLocale, useMessages, useTranslations } from "next-intl";
import { useCallback, useMemo, type ReactNode } from "react";

export type MentorBottomSheetActionSheetOptions = Omit<
  BottomSheetActionSheetOptions,
  "cancelLabel" | "closeLabel"
> & {
  cancelLabel?: string;
  closeLabel?: string;
};

export type MentorBottomSheetFilterOptions = Omit<
  BottomSheetFilterOptions,
  "closeLabel"
> & {
  closeLabel?: string;
};

export type MentorBottomSheetShowOptions = Omit<
  BottomSheetShowOptions,
  "closeLabel" | "cancelLabel"
> & {
  closeLabel?: string;
  cancelLabel?: string;
};

/** Web wrapper: injects i18n cancel/close labels for bottom sheet presets. */
export function useMentorBottomSheet() {
  const sheet = useBottomSheet();
  const t = useTranslations("common.bottom_sheet");
  const cancelLabel = t("cancel");
  const closeLabel = t("close");

  /*
   * Sheet CONTENT has to carry its own i18n provider.
   *
   * `BottomSheetProviderShell` is mounted in the root layout, above `children`, and the root
   * layout narrows its `NextIntlClientProvider` to `ROUTE_MESSAGE_SCOPES.root` for bundle size.
   * A `children` node handed to `show`/`filterSheet` is *rendered* by the viewport up there, not
   * where it was written, so it sees that narrow set — never the route's own namespaces. Every
   * label inside it then rendered as its raw key: the plan calendar's "Yeni etkinlik" sheet shipped
   * `plan.all_day`, `plan.time_start`, `plan.subject` to users as literal text.
   *
   * This hook runs in the CALLER's tree, so `useMessages()` here is the route's own bundle. Wrap
   * the node in it and the content lands with the messages the author expected. `actionSheet` needs
   * nothing: its options are already-resolved strings, which is why those sheets were never broken.
   */
  const locale = useLocale();
  const messages = useMessages();
  const withMessages = useCallback(
    (children: ReactNode) => (
      <NextIntlClientProvider locale={locale} messages={messages}>
        {children}
      </NextIntlClientProvider>
    ),
    [locale, messages],
  );

  const show = useCallback(
    (options: MentorBottomSheetShowOptions) =>
      sheet.show({
        ...options,
        children: options.children ? withMessages(options.children) : options.children,
        cancelLabel: options.cancelLabel ?? cancelLabel,
        closeLabel: options.closeLabel ?? closeLabel,
      }),
    [cancelLabel, closeLabel, sheet, withMessages],
  );

  const actionSheet = useCallback(
    (options: MentorBottomSheetActionSheetOptions) =>
      sheet.actionSheet({
        ...options,
        cancelLabel: options.cancelLabel ?? cancelLabel,
        closeLabel: options.closeLabel ?? closeLabel,
      }),
    [cancelLabel, closeLabel, sheet],
  );

  const filterSheet = useCallback(
    (options: MentorBottomSheetFilterOptions) =>
      sheet.filterSheet({
        ...options,
        children: withMessages(options.children),
        closeLabel: options.closeLabel ?? closeLabel,
      }),
    [closeLabel, sheet, withMessages],
  );

  return useMemo(
    () => ({
      sheet: sheet.sheet,
      show,
      dismiss: sheet.dismiss,
      dismissNow: sheet.dismissNow,
      actionSheet,
      filterSheet,
    }),
    [actionSheet, filterSheet, sheet.dismiss, sheet.dismissNow, sheet.sheet, show],
  );
}
