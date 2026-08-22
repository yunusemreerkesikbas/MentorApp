"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import type {
  ExamSubjectDto,
  ExamTopicDto,
  NotebookEntryDto,
  NotebookErrorType,
} from "@mentor/types";
import { NOTEBOOK_ERROR_TYPES } from "@mentor/types";
import { SectionHeading } from "@mentor/ui";
import { MenuSelect } from "@/components/menu-select";
import { FormError } from "@/components/form";
import { NotebookCompactButton } from "@/components/notebook/notebook-compact-button";
import { deleteNotebookEntry, updateNotebookEntry } from "@/lib/notebook";

/**
 * A filed card's settings: what it was, and whether it should exist at all.
 *
 * Two things had no way in before this. A mislabelled entry stayed mislabelled — and the labels are
 * not decoration, they are what the analysis screen's weakness map is built from, so a wrong subject
 * quietly skews the one report the student makes decisions with. And nothing could delete an entry
 * at all: the endpoint, its client, and the R2 photo cleanup all existed with no caller, which left
 * the student's photo living at a public URL with no way to take it down.
 *
 * Deliberately not on the flashcard's back. The card back is where you write what you learned; this
 * is where you correct the filing. Mixing a destructive action into the review deck was also the
 * one thing rejected outright — the deck should never be a place where a card can vanish.
 */
export function NotebookEntryEditDialog({
  entry,
  subjects,
  topics,
  onSaved,
  onDeleted,
  onClose,
}: {
  entry: NotebookEntryDto;
  subjects: ExamSubjectDto[];
  topics: ExamTopicDto[];
  onSaved: (entry: NotebookEntryDto) => void;
  onDeleted: (entryId: string) => void;
  onClose: () => void;
}) {
  const t = useTranslations("notebook");
  const reactId = useId();
  const subjectLabelId = `notebook-edit-subject-${reactId}`;
  const topicLabelId = `notebook-edit-topic-${reactId}`;

  const [errorType, setErrorType] = useState<NotebookErrorType>(entry.errorType);
  const [subjectRef, setSubjectRef] = useState(entry.subjectRef ?? "");
  const [topicRef, setTopicRef] = useState<string | null>(entry.topicRef);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subjectTopics = subjectRef
    ? topics.filter((topic) => topic.subjectSlug === subjectRef)
    : [];

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const updated = await updateNotebookEntry(entry.id, {
        errorType,
        subjectRef: subjectRef || null,
        // A topic is meaningless without its subject, and the service validates the pair against
        // the entry's own exam — sending one alone is a guaranteed rejection.
        topicRef: subjectRef ? topicRef : null,
      });
      onSaved(updated);
    } catch {
      setError(t("error_save"));
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await deleteNotebookEntry(entry.id);
      onDeleted(entry.id);
    } catch {
      setError(t("error_entry_delete"));
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t("entry_edit_title")}
    >
      <div
        className="flex w-full max-w-md flex-col gap-4 overflow-y-auto rounded-[var(--radius-card)] p-6"
        style={{
          maxHeight: "85vh",
          background: "var(--color-surface)",
          border: "1px solid color-mix(in srgb, var(--color-main) 10%, transparent)",
          boxShadow: "var(--shadow-card)",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <SectionHeading as="h2">{t("entry_edit_title")}</SectionHeading>

        <FormError message={error} />

        <fieldset className="flex flex-col gap-2">
          <legend
            className="text-sm font-semibold"
            style={{ color: "var(--color-main)" }}
          >
            {t("add_error_type_legend")}
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
                  {t(`error_type.${type}`)}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="flex flex-col gap-1">
          <span
            id={subjectLabelId}
            className="text-sm font-semibold"
            style={{ color: "var(--color-main)" }}
          >
            {t("add_subject_label")}
          </span>
          <MenuSelect
            value={subjectRef}
            aria-labelledby={subjectLabelId}
            options={[
              { value: "", label: t("add_subject_none") },
              ...subjects.map((subject) => ({
                value: subject.slug,
                label: subject.name,
              })),
            ]}
            onChange={(next) => {
              setSubjectRef(next);
              // A hand-picked subject invalidates a topic that belonged to another one.
              setTopicRef(null);
            }}
          />
        </div>

        {subjectTopics.length > 0 ? (
          <div className="flex flex-col gap-1">
            <span
              id={topicLabelId}
              className="text-sm font-semibold"
              style={{ color: "var(--color-main)" }}
            >
              {t("add_topic_label")}
            </span>
            <MenuSelect
              value={topicRef ?? ""}
              aria-labelledby={topicLabelId}
              options={[
                { value: "", label: t("add_topic_none") },
                ...subjectTopics.map((topic) => ({
                  value: topic.slug,
                  label: topic.name,
                })),
              ]}
              onChange={(next) => setTopicRef(next || null)}
            />
          </div>
        ) : null}

        <div className="flex gap-2">
          <NotebookCompactButton busy={busy} onClick={() => void save()}>
            {t("entry_edit_save")}
          </NotebookCompactButton>
          <NotebookCompactButton
            variant="secondary"
            disabled={busy}
            onClick={onClose}
          >
            {t("add_cancel")}
          </NotebookCompactButton>
        </div>

        {/* Below the save row and behind a confirm: deleting takes the photo down with the entry,
            and there is no undo for either. */}
        <div
          className="flex flex-col gap-2 pt-2"
          style={{
            borderTop:
              "1px solid color-mix(in srgb, var(--color-main) 10%, transparent)",
          }}
        >
          {confirmingDelete ? (
            <>
              <p className="text-sm" style={{ color: "var(--color-body)" }}>
                {t("entry_delete_confirm")}
              </p>
              <div className="flex gap-2">
                <NotebookCompactButton busy={busy} onClick={() => void remove()}>
                  {t("entry_delete")}
                </NotebookCompactButton>
                <NotebookCompactButton
                  variant="secondary"
                  disabled={busy}
                  onClick={() => setConfirmingDelete(false)}
                >
                  {t("add_cancel")}
                </NotebookCompactButton>
              </div>
            </>
          ) : (
            <NotebookCompactButton
              variant="ghost"
              disabled={busy}
              onClick={() => setConfirmingDelete(true)}
            >
              {t("entry_delete")}
            </NotebookCompactButton>
          )}
        </div>
      </div>
    </div>
  );
}
