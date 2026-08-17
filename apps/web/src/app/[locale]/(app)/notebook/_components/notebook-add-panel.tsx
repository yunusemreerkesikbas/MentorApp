"use client";

import { useId, useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import type { ExamSubjectDto, ExamTopicDto, NotebookEntryDto } from "@mentor/types";
import { NOTEBOOK_ERROR_TYPES, type NotebookErrorType } from "@mentor/types";
import { Card, SectionHeading, TextAreaField } from "@mentor/ui";
import { FormError } from "@/components/form";
import { MenuSelect } from "@/components/menu-select";
import { NotebookCompactButton } from "@/components/notebook/notebook-compact-button";
import {
  createNotebookEntry,
  isSupportedNotebookImage,
  isWithinNotebookImageLimit,
  prelabelNotebookPhoto,
  uploadNotebookImage,
} from "@/lib/notebook";

/** width/height of the uploaded file itself — what the placed card on the page is sized from
 *  (`nextEntrySlot`), so a portrait exam photo lands in a portrait slot, not a letterboxed one. */
function measureImageAspect(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img.naturalWidth / img.naturalHeight);
    img.onerror = reject;
    img.src = url;
  });
}

interface NotebookAddPanelProps {
  examId: string;
  subjects: ExamSubjectDto[];
  topics: ExamTopicDto[];
  /** `aspect` is the uploaded photo's own width/height, null for a text-only mistake. */
  onCreated: (entry: NotebookEntryDto, aspect: number | null) => void;
  onCancel: () => void;
}

/**
 * Add one mistake.
 *
 * The error type is the only required field, and that is the whole design: a photo is optional, a
 * label is optional, but "why did you miss it?" is the question the notebook exists to ask. Make it
 * skippable and the wall degrades into the photo album the student already fails to review.
 *
 * An inline panel rather than a bottom sheet: `BottomSheetProvider` is an imperative action/filter
 * API, and a free-form form fights it. ponytail: promote to a sheet if this ever needs to open from
 * somewhere other than the notebook page.
 */
export function NotebookAddPanel({
  examId,
  subjects,
  topics,
  onCreated,
  onCancel,
}: NotebookAddPanelProps) {
  const t = useTranslations("notebook");
  const fileRef = useRef<HTMLInputElement>(null);
  const reactId = useId();
  const subjectLabelId = `notebook-add-subject-${reactId}`;
  const topicLabelId = `notebook-add-topic-${reactId}`;

  const [errorType, setErrorType] = useState<NotebookErrorType | null>(null);
  const [subjectRef, setSubjectRef] = useState<string>("");
  const [topicRef, setTopicRef] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<{ key: string; url: string; aspect: number | null } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [prelabelling, setPrelabelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filtered from the whole taxonomy rather than fetched per subject: the list is small, and a
  // fetch on every subject change would put a spinner in the middle of a two-tap form.
  const subjectTopics = subjectRef
    ? topics.filter((topic) => topic.subjectSlug === subjectRef)
    : [];

  async function handleFile(file: File | null) {
    if (!file) return;
    if (!isSupportedNotebookImage(file)) return setError(t("error_type_unsupported"));
    if (!isWithinNotebookImageLimit(file)) return setError(t("error_too_big"));

    setError(null);
    setBusy(true);
    try {
      const uploaded = await uploadNotebookImage(file);
      // A failed measurement (rare — the same URL just loaded successfully via `uploadNotebookImage`)
      // still leaves a usable entry: `nextEntrySlot` just falls back to its own default height.
      const aspect = await measureImageAspect(uploaded.url).catch(() => null);
      setPhoto({ ...uploaded, aspect });

      // Premium nicety, never a gate: the form is already usable without it, so a failure here
      // silently leaves the labels for the student to fill in.
      setPrelabelling(true);
      const suggestion = await prelabelNotebookPhoto(uploaded.key, examId);
      if (suggestion?.subjectRef) {
        setSubjectRef(suggestion.subjectRef);
        setTopicRef(suggestion.topicRef);
      }
    } catch {
      setError(t("error_upload"));
    } finally {
      setPrelabelling(false);
      setBusy(false);
    }
  }

  async function handleSubmit() {
    if (!errorType) return;
    setBusy(true);
    setError(null);
    try {
      const entry = await createNotebookEntry({
        examId,
        source: "OWN",
        storageKey: photo?.key ?? null,
        subjectRef: subjectRef || null,
        // A topic only ever comes from a pre-label, and it is meaningless without its subject.
        topicRef: subjectRef ? topicRef : null,
        errorType,
        note: note.trim() || null,
      });
      onCreated(entry, photo?.aspect ?? null);
    } catch {
      setError(t("error_save"));
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col gap-4">
      <SectionHeading as="h2" subtitle={t("add_subtitle")}>
        {t("add_title")}
      </SectionHeading>

      <FormError message={error} />

      {photo ? (
        <div
          className="relative mx-auto w-full max-w-xs overflow-hidden rounded-[var(--radius-card)]"
          style={{
            aspectRatio: photo.aspect ?? 4 / 3,
            backgroundColor: "var(--color-surface-container)",
          }}
        >
          <Image src={photo.url} alt="" fill className="object-contain" unoptimized />
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <NotebookCompactButton
            variant="secondary"
            fullWidth
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            {t("add_photo")}
          </NotebookCompactButton>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            className="sr-only"
            onChange={(event) => {
              void handleFile(event.target.files?.[0] ?? null);
              event.target.value = "";
            }}
          />
          <p className="text-xs" style={{ color: "var(--color-secondary)" }}>
            {t("add_photo_optional")}
          </p>
        </div>
      )}

      {/* The one required answer, and the first thing on the form. */}
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-semibold" style={{ color: "var(--color-main)" }}>
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
                  color: selected ? "#ffffff" : "var(--color-main)",
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
          {prelabelling ? ` · ${t("add_prelabelling")}` : ""}
        </span>
        <MenuSelect
          value={subjectRef}
          aria-labelledby={subjectLabelId}
          options={[
            { value: "", label: t("add_subject_none") },
            ...subjects.map((subject) => ({ value: subject.slug, label: subject.name })),
          ]}
          onChange={(next) => {
            setSubjectRef(next);
            // A hand-picked subject invalidates a topic that belonged to another one.
            setTopicRef(null);
          }}
        />
      </div>

      {/*
        The topic picker is free, and that matters: the topic-level weakness map is the headline of
        the analysis screen, and until this list existed the only way to fill it was the premium
        pre-label — a paywall by accident rather than by decision. Premium still saves the two taps.
      */}
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
              { value: "", label: t("add_subject_none") },
              ...subjectTopics.map((topic) => ({ value: topic.slug, label: topic.name })),
            ]}
            onChange={(next) => setTopicRef(next || null)}
          />
        </div>
      ) : null}

      <TextAreaField
        label={t("add_note_label")}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        maxLength={500}
        rows={3}
      />

      <div className="flex gap-2">
        <NotebookCompactButton busy={busy} disabled={!errorType} onClick={() => void handleSubmit()}>
          {t("add_submit")}
        </NotebookCompactButton>
        <NotebookCompactButton variant="secondary" disabled={busy} onClick={onCancel}>
          {t("add_cancel")}
        </NotebookCompactButton>
      </div>
    </Card>
  );
}
