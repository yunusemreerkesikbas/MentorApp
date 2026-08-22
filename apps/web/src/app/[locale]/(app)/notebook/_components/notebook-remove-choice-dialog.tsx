"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { SectionHeading } from "@mentor/ui";
import { FormError } from "@/components/form";
import { NotebookCompactButton } from "@/components/notebook/notebook-compact-button";

/**
 * Which "delete" did the student mean?
 *
 * The page's trash used to answer that silently, and it picked the weaker meaning: the card came
 * off the paper while the entry stayed in the book, kept its review schedule, and turned up in the
 * deck the next morning. Everyone who pressed it believed they had deleted the mistake. The two
 * meanings are genuinely different — one is arranging the page, the other takes the photo down
 * with the entry — so the button asks instead of guessing.
 */
export function NotebookRemoveChoiceDialog({
  onRemoveFromPage,
  onDeleteEntry,
  onClose,
}: {
  onRemoveFromPage: () => void;
  onDeleteEntry: () => Promise<void>;
  onClose: () => void;
}) {
  const t = useTranslations("notebook");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t("entry_remove_title")}
    >
      <div
        className="flex w-full max-w-md flex-col gap-4 rounded-[var(--radius-card)] p-6"
        style={{
          background: "var(--color-surface)",
          border: "1px solid color-mix(in srgb, var(--color-main) 10%, transparent)",
          boxShadow: "var(--shadow-card)",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <SectionHeading as="h2" subtitle={t("entry_remove_subtitle")}>
          {t("entry_remove_title")}
        </SectionHeading>

        <FormError message={error} />

        <div className="flex flex-col gap-2">
          <NotebookCompactButton
            variant="secondary"
            fullWidth
            disabled={busy}
            onClick={onRemoveFromPage}
          >
            {t("entry_remove_from_page")}
          </NotebookCompactButton>
          <NotebookCompactButton
            variant="secondary"
            fullWidth
            busy={busy}
            onClick={() => {
              setBusy(true);
              setError(null);
              void onDeleteEntry().catch(() => {
                setError(t("error_entry_delete"));
                setBusy(false);
              });
            }}
          >
            {t("entry_delete")}
          </NotebookCompactButton>
          <NotebookCompactButton
            variant="ghost"
            fullWidth
            disabled={busy}
            onClick={onClose}
          >
            {t("add_cancel")}
          </NotebookCompactButton>
        </div>
      </div>
    </div>
  );
}
