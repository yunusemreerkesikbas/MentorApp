"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { AuthUser, ExamCalendarDto, NotebookErrorType } from "@mentor/types";
import { NOTEBOOK_ERROR_TYPES } from "@mentor/types";
import {
  contentControllerCalendarByFamily,
  usersControllerMe,
} from "@mentor/api-client";
import { Button, SectionHeading, TextAreaField } from "@mentor/ui";
import { FormError } from "@/components/form";
import { createNotebookEntry } from "@/lib/notebook";

/**
 * "I could not solve this one either" — the community half of the mistake notebook's bridge.
 *
 * The schema comment is explicit about what this action means: a community question enters the
 * notebook only on the user's own admission that they could not do it, and from then on it counts
 * toward their weakness map exactly like a mistake of their own. Something they merely found
 * interesting belongs in the forum's own bookmarks, or the map starts describing other people's
 * gaps. That is why this is a dialog and not a one-tap "save": the error type is a real answer the
 * student has to give, and the copy asks the honest question rather than offering a filing cabinet.
 *
 * `examId` is fetched when the dialog opens rather than with the page — every reader of every
 * thread would otherwise pay for a request that only matters to the few who press this.
 */
export function NotebookAddDialog({
  threadId,
  onAdded,
  onClose,
}: {
  threadId: string;
  onAdded: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("community");
  const tn = useTranslations("notebook");
  const [errorType, setErrorType] = useState<NotebookErrorType | null>(null);
  const [note, setNote] = useState("");
  const [examId, setExamId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const me = (await usersControllerMe()) as unknown as AuthUser;
        if (!me.examType) return;
        const calendar = (await contentControllerCalendarByFamily(
          me.examType,
        )) as unknown as ExamCalendarDto | null;
        if (!cancelled) setExamId(calendar?.exam?.id ?? null);
      } catch {
        if (!cancelled) setError(t("notebook_add_error"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  async function submit() {
    if (!errorType || !examId) return;
    setBusy(true);
    setError(null);
    try {
      await createNotebookEntry({
        examId,
        source: "COMMUNITY",
        communityThreadId: threadId,
        errorType,
        note: note.trim() || null,
      });
      onAdded();
    } catch {
      setError(t("notebook_add_error"));
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.85)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t("notebook_add_title")}
    >
      <div
        className="flex w-full max-w-md flex-col gap-4 overflow-hidden rounded-[var(--radius-card)] p-6"
        style={{
          background: "var(--color-surface)",
          border: "1px solid color-mix(in srgb, var(--color-main) 10%, transparent)",
          boxShadow: "var(--shadow-card)",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <SectionHeading as="h2" subtitle={t("notebook_add_subtitle")}>
          {t("notebook_add_title")}
        </SectionHeading>

        <FormError message={error} />

        {/* The same chips the notebook's own add panel uses, and the same single required answer. */}
        <fieldset className="flex flex-col gap-2">
          <legend
            className="text-sm font-semibold"
            style={{ color: "var(--color-main)" }}
          >
            {tn("add_error_type_legend")}
          </legend>
          <div className="flex flex-wrap gap-2">
            {NOTEBOOK_ERROR_TYPES.map((type) => {
              const selected = errorType === type;
              return (
                <button
                  key={type}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setErrorType(type)}
                  className="inline-flex min-h-9 cursor-pointer items-center rounded-full px-3 text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
                  style={{
                    color: selected ? "var(--color-btn-label)" : "var(--color-main)",
                    backgroundColor: selected ? "var(--color-btn)" : "transparent",
                    border: selected
                      ? "1px solid var(--color-btn)"
                      : "1px solid color-mix(in srgb, var(--color-main) 15%, transparent)",
                  }}
                >
                  {tn(`error_type.${type}`)}
                </button>
              );
            })}
          </div>
        </fieldset>

        <TextAreaField
          label={tn("add_note_label")}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={500}
          rows={3}
        />

        <div className="flex flex-wrap gap-2">
          <Button
            busy={busy}
            disabled={!errorType || !examId}
            onClick={() => void submit()}
          >
            {t("notebook_add_submit")}
          </Button>
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            {tn("add_cancel")}
          </Button>
        </div>
      </div>
    </div>
  );
}
