"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import type { ExamSubjectDto, ExamTopicDto, NotebookEntryDto } from "@mentor/types";
import { NOTEBOOK_ERROR_TYPES, type NotebookErrorType } from "@mentor/types";
import { Card, SectionHeading, TextAreaField } from "@mentor/ui";
import { FormError } from "@/components/form";
import { TaxonomyCascadeSelect } from "@/components/taxonomy-cascade-select";
import { NotebookCompactButton } from "@/components/notebook/notebook-compact-button";
import {
  createNotebookEntry,
  isSupportedNotebookImage,
  isWithinNotebookImageLimit,
  uploadNotebookImage,
} from "@/lib/notebook";
import { measureImageAspect } from "@/lib/notebook-image-aspect";

interface NotebookAddPanelProps {
  examId: string;
  /** The mock exam these mistakes came out of, when the student arrived from the analysis screen. */
  mockExamId: string | null;
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
  mockExamId,
  subjects,
  topics,
  onCreated,
  onCancel,
}: NotebookAddPanelProps) {
  const t = useTranslations("notebook");
  const fileRef = useRef<HTMLInputElement>(null);
  const solutionFileRef = useRef<HTMLInputElement>(null);

  const [errorType, setErrorType] = useState<NotebookErrorType | null>(null);
  const [subjectRef, setSubjectRef] = useState<string>("");
  const [topicRef, setTopicRef] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<{ key: string; url: string; aspect: number | null } | null>(
    null,
  );
  const [solutionNote, setSolutionNote] = useState("");
  const [solutionPhoto, setSolutionPhoto] = useState<{ key: string; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | null) {
    if (!file) return;
    if (!isSupportedNotebookImage(file)) return setError(t("error_type_unsupported"));
    if (!isWithinNotebookImageLimit(file)) return setError(t("error_too_big"));

    setError(null);
    setBusy(true);
    try {
      const uploaded = await uploadNotebookImage(file);
      const aspect = await measureImageAspect(uploaded.url).catch(() => null);
      setPhoto({ ...uploaded, aspect });
    } catch {
      setError(t("error_upload"));
    } finally {
      setBusy(false);
    }
  }

  /**
   * The answer photo. Upload only: running vision over an answer key would be asking it what the
   * solution says, which is the line the notebook does not cross (AGENTS.md §4).
   */
  async function handleSolutionFile(file: File | null) {
    if (!file) return;
    if (!isSupportedNotebookImage(file)) return setError(t("error_type_unsupported"));
    if (!isWithinNotebookImageLimit(file)) return setError(t("error_too_big"));

    setError(null);
    setBusy(true);
    try {
      const uploaded = await uploadNotebookImage(file);
      setSolutionPhoto({ key: uploaded.key, url: uploaded.url });
    } catch {
      setError(t("error_upload"));
    } finally {
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
        mockExamId,
        source: "OWN",
        storageKey: photo?.key ?? null,
        subjectRef: subjectRef || null,
        topicRef: subjectRef ? topicRef : null,
        errorType,
        note: note.trim() || null,
        solutionStorageKey: solutionPhoto?.key ?? null,
        solutionNote: solutionNote.trim() || null,
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

      <TaxonomyCascadeSelect
        subjects={subjects}
        topics={topics}
        subjectValue={subjectRef}
        topicValue={topicRef ?? ""}
        subjectLabel={t("add_subject_label")}
        emptySubjectLabel={t("add_subject_none")}
        topicLabel={t("add_topic_label")}
        emptyTopicLabel={t("add_subject_none")}
        onSubjectChange={setSubjectRef}
        onTopicChange={(next) => setTopicRef(next || null)}
      />

      <TextAreaField
        label={t("add_note_label")}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        maxLength={500}
        rows={3}
      />

      {/* The answer, both halves optional. Last on the form on purpose: `errorType` stays the only
          required field, and a student who does not have the answer key in front of them should be
          able to file the mistake and walk away. */}
      <div className="flex flex-col gap-2">
        {solutionPhoto ? (
          <div
            className="relative mx-auto w-full max-w-xs overflow-hidden rounded-[var(--radius-card)]"
            style={{ aspectRatio: 4 / 3, backgroundColor: "var(--color-surface-container)" }}
          >
            <Image src={solutionPhoto.url} alt="" fill className="object-contain" unoptimized />
          </div>
        ) : (
          <NotebookCompactButton
            variant="secondary"
            fullWidth
            disabled={busy}
            onClick={() => solutionFileRef.current?.click()}
          >
            {t("add_solution_photo")}
          </NotebookCompactButton>
        )}
        <input
          ref={solutionFileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          className="sr-only"
          onChange={(event) => {
            void handleSolutionFile(event.target.files?.[0] ?? null);
            event.target.value = "";
          }}
        />
        <TextAreaField
          label={t("add_solution_note_label")}
          value={solutionNote}
          onChange={(event) => setSolutionNote(event.target.value)}
          maxLength={500}
          rows={2}
        />
      </div>

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
