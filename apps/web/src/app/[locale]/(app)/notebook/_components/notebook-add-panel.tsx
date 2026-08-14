"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import type { ExamSubjectDto, NotebookEntryDto } from "@mentor/types";
import { NOTEBOOK_ERROR_TYPES, type NotebookErrorType } from "@mentor/types";
import { Button, Card, SectionHeading, TextAreaField } from "@mentor/ui";
import { FormError } from "@/components/form";
import {
  createNotebookEntry,
  isSupportedNotebookImage,
  isWithinNotebookImageLimit,
  prelabelNotebookPhoto,
  uploadNotebookImage,
} from "@/lib/notebook";

interface NotebookAddPanelProps {
  examId: string;
  subjects: ExamSubjectDto[];
  onCreated: (entry: NotebookEntryDto) => void;
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
  onCreated,
  onCancel,
}: NotebookAddPanelProps) {
  const t = useTranslations("notebook");
  const fileRef = useRef<HTMLInputElement>(null);

  const [errorType, setErrorType] = useState<NotebookErrorType | null>(null);
  const [subjectRef, setSubjectRef] = useState<string>("");
  const [topicRef, setTopicRef] = useState<string | null>(null);
  const [topicName, setTopicName] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<{ key: string; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [prelabelling, setPrelabelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | null) {
    if (!file) return;
    if (!isSupportedNotebookImage(file)) return setError(t("error_type_unsupported"));
    if (!isWithinNotebookImageLimit(file)) return setError(t("error_too_big"));

    setError(null);
    setBusy(true);
    try {
      const uploaded = await uploadNotebookImage(file);
      setPhoto(uploaded);

      // Premium nicety, never a gate: the form is already usable without it, so a failure here
      // silently leaves the labels for the student to fill in.
      setPrelabelling(true);
      const suggestion = await prelabelNotebookPhoto(uploaded.key, examId);
      if (suggestion?.subjectRef) {
        setSubjectRef(suggestion.subjectRef);
        setTopicRef(suggestion.topicRef);
        setTopicName(suggestion.topicName);
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
        storageKey: photo?.key ?? null,
        subjectRef: subjectRef || null,
        // A topic only ever comes from a pre-label, and it is meaningless without its subject.
        topicRef: subjectRef ? topicRef : null,
        errorType,
        note: note.trim() || null,
      });
      onCreated(entry);
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
        <div className="relative mx-auto aspect-[4/3] w-full max-w-xs overflow-hidden rounded-[var(--radius-card)]">
          <Image src={photo.url} alt="" fill className="object-contain" unoptimized />
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            {t("add_photo")}
          </Button>
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

      <label className="flex flex-col gap-1">
        <span className="text-sm font-semibold" style={{ color: "var(--color-main)" }}>
          {t("add_subject_label")}
          {prelabelling ? ` · ${t("add_prelabelling")}` : ""}
        </span>
        {/* Native select: the platform already ships a good one on every phone. */}
        <select
          value={subjectRef}
          onChange={(event) => {
            setSubjectRef(event.target.value);
            // A hand-picked subject invalidates a suggested topic that belonged to another one.
            setTopicRef(null);
            setTopicName(null);
          }}
          className="min-h-11 rounded-[var(--radius-card)] border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          style={{
            color: "var(--color-main)",
            borderColor: "color-mix(in srgb, var(--color-main) 15%, transparent)",
            backgroundColor: "var(--color-surface)",
          }}
        >
          <option value="">{t("add_subject_none")}</option>
          {subjects.map((subject) => (
            <option key={subject.slug} value={subject.slug}>
              {subject.name}
            </option>
          ))}
        </select>
        {topicName && subjectRef ? (
          <span className="text-xs" style={{ color: "var(--color-secondary)" }}>
            {t("add_topic_suggested", { topic: topicName })}
          </span>
        ) : null}
      </label>

      <TextAreaField
        label={t("add_note_label")}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        maxLength={500}
        rows={3}
      />

      <div className="flex flex-wrap gap-2">
        <Button disabled={busy || !errorType} onClick={() => void handleSubmit()}>
          {t("add_submit")}
        </Button>
        <Button variant="secondary" disabled={busy} onClick={onCancel}>
          {t("add_cancel")}
        </Button>
      </div>
    </Card>
  );
}
