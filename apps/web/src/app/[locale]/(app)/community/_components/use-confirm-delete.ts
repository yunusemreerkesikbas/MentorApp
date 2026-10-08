"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { useMentorDialog } from "@/lib/mentor-dialog";

/**
 * The kit's destructive confirm for deleting a post, answer or comment (DESIGN.md §6.1 Dialog):
 * focus starts on "Vazgeç", the ledge turns danger. Replaces `window.confirm`.
 */
export function useConfirmDelete() {
  const t = useTranslations("community");
  const dialog = useMentorDialog();
  return useCallback(
    () =>
      dialog.confirm({
        title: t("delete_confirm_title"),
        message: t("delete_confirm"),
        confirmLabel: t("delete"),
        cancelLabel: t("cancel"),
        destructive: true,
      }),
    [dialog, t],
  );
}
