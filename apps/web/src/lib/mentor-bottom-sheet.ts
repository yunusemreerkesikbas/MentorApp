"use client";

import {
  useBottomSheet,
  type BottomSheetActionSheetOptions,
  type BottomSheetFilterOptions,
  type BottomSheetShowOptions,
} from "@mentor/ui";
import { useTranslations } from "next-intl";
import { useCallback, useMemo } from "react";

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

  const show = useCallback(
    (options: MentorBottomSheetShowOptions) =>
      sheet.show({
        ...options,
        cancelLabel: options.cancelLabel ?? cancelLabel,
        closeLabel: options.closeLabel ?? closeLabel,
      }),
    [cancelLabel, closeLabel, sheet],
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
        closeLabel: options.closeLabel ?? closeLabel,
      }),
    [closeLabel, sheet],
  );

  return useMemo(
    () => ({
      sheet: sheet.sheet,
      show,
      dismiss: sheet.dismiss,
      actionSheet,
      filterSheet,
    }),
    [actionSheet, filterSheet, sheet.dismiss, sheet.sheet, show],
  );
}
