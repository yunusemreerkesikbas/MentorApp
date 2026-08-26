"use client";

import { useId, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import type {
  ExamSubjectDto,
  NotebookCoverColor,
  NotebookCoverMaterial,
  NotebookDto,
  NotebookSummaryDto,
} from "@mentor/types";
import { NOTEBOOK_COVER_COLORS, NOTEBOOK_COVER_MATERIALS } from "@mentor/types";
import { Button, Modal, TextField } from "@mentor/ui";
import { MenuSelect } from "@/components/menu-select";
import {
  COVER_COLORS,
  COVER_MATERIALS,
} from "@/components/notebook/notebook-surface";
import { createNotebook, updateNotebook } from "@/lib/notebook";

interface ExamChoice {
  id: string;
  subjects: ExamSubjectDto[];
}

const DEFAULT_COVER = { color: "navy", material: "cloth" } as const;

export function NotebookFormDialog({
  current,
  exam,
  onClose,
  onSaved,
}: {
  current: NotebookSummaryDto | null;
  exam: ExamChoice | null;
  onClose: () => void;
  onSaved: (saved: NotebookDto) => void;
}) {
  const t = useTranslations("notebooks.form");
  const notebookT = useTranslations("notebook");
  const reactId = useId();
  const titleInputId = `notebook-title-${reactId}`;
  const subjectLabelId = `notebook-subject-${reactId}`;
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(current?.title ?? "");
  const [subjectRef, setSubjectRef] = useState(current?.subjectRef ?? "");
  const [color, setColor] = useState<NotebookCoverColor>(
    current?.cover.color ?? DEFAULT_COVER.color,
  );
  const [material, setMaterial] = useState<NotebookCoverMaterial>(
    current?.cover.material ?? DEFAULT_COVER.material,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  const subjects = [...(exam?.subjects ?? [])];
  if (
    current?.subjectRef &&
    !subjects.some((subject) => subject.slug === current.subjectRef)
  ) {
    subjects.push({
      slug: current.subjectRef,
      name: current.subjectName ?? current.subjectRef,
    } as ExamSubjectDto);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(false);
    try {
      const selectedExamId = subjectRef
        ? current?.examId && subjectRef === current.subjectRef
          ? current.examId
          : (exam?.id ?? null)
        : null;
      const saved = current
        ? await updateNotebook(current.id, {
            title,
            examId: selectedExamId,
            subjectRef: subjectRef || null,
            cover: { color, material },
          })
        : await createNotebook({
            title,
            examId: selectedExamId,
            subjectRef: subjectRef || null,
            cover: { color, material },
          });
      onSaved(saved);
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={current ? t("edit_title") : t("create_title")}
      closeLabel={t("close")}
      onClose={onClose}
      closeDisabled={saving}
      initialFocusRef={titleInputRef}
      onSubmit={(event) => void submit(event)}
      footer={
        <>
          <Button
            type="button"
            variant="ghost"
            disabled={saving}
            onClick={onClose}
          >
            {t("cancel")}
          </Button>
          <Button
            type="submit"
            busy={saving}
            disabled={title.trim().length === 0}
          >
            {t("save")}
          </Button>
        </>
      }
    >
      <TextField
        id={titleInputId}
        ref={titleInputRef}
        disabled={saving}
        required
        minLength={1}
        maxLength={40}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        label={t("title_label")}
      />
      <div className="flex flex-col gap-1">
        <span
          id={subjectLabelId}
          className="text-xs font-semibold"
          style={{
            color: "var(--color-secondary)",
            fontFamily: "var(--font-heading)",
          }}
        >
          {t("subject_label")}
        </span>
        <MenuSelect
          value={subjectRef}
          disabled={saving}
          aria-labelledby={subjectLabelId}
          options={[
            { value: "", label: t("subject_none") },
            ...subjects.map((subject) => ({
              value: subject.slug,
              label: subject.name,
            })),
          ]}
          onChange={setSubjectRef}
        />
      </div>
      <fieldset className="flex flex-col gap-2 overflow-visible">
        <legend
          className="text-xs font-semibold"
          style={{
            color: "var(--color-secondary)",
            fontFamily: "var(--font-heading)",
          }}
        >
          {t("color_label")}
        </legend>
        <div className="flex flex-wrap items-center gap-1">
          {NOTEBOOK_COVER_COLORS.map((value) => (
            <CoverChoiceSwatch
              key={value}
              label={notebookT(`cover_color.${value}`)}
              selected={color === value}
              disabled={saving}
              size="dot"
              preview={{ backgroundColor: COVER_COLORS[value] }}
              onClick={() => setColor(value)}
            />
          ))}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-2 overflow-visible">
        <legend
          className="text-xs font-semibold"
          style={{
            color: "var(--color-secondary)",
            fontFamily: "var(--font-heading)",
          }}
        >
          {t("material_label")}
        </legend>
        <div className="flex flex-wrap items-center gap-2">
          {NOTEBOOK_COVER_MATERIALS.map((value) => (
            <CoverChoiceSwatch
              key={value}
              label={notebookT(`cover_material.${value}`)}
              selected={material === value}
              disabled={saving}
              size="tile"
              preview={{
                backgroundColor: COVER_COLORS[color],
                backgroundImage: COVER_MATERIALS[value],
              }}
              onClick={() => setMaterial(value)}
            />
          ))}
        </div>
      </fieldset>
      {error ? (
        <p role="alert" className="text-sm text-[var(--color-danger)]">
          {t("error")}
        </p>
      ) : null}
    </Modal>
  );
}

/**
 * Cover option preview. `dot` matches the notebook text-plate swatch (colour).
 * `tile` is a 44px material sample — cloth/kraft/leather/matte cannot be told
 * apart at plate-dot size, and a hover-only enlarge would leave touch users
 * guessing. The name still appears on hover/focus.
 */
function CoverChoiceSwatch({
  label,
  selected,
  disabled,
  size,
  preview,
  onClick,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  size: "dot" | "tile";
  preview: CSSProperties;
  onClick: () => void;
}) {
  const [showName, setShowName] = useState(false);
  const isTile = size === "tile";
  const selectedOutline = selected
    ? "2px solid var(--color-accent)"
    : "1px solid color-mix(in srgb, var(--color-main) 12%, transparent)";

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={label}
      aria-pressed={selected}
      onClick={onClick}
      onMouseEnter={() => setShowName(true)}
      onMouseLeave={() => setShowName(false)}
      onFocus={() => setShowName(true)}
      onBlur={() => setShowName(false)}
      className={
        isTile
          ? "relative size-11 shrink-0 cursor-pointer overflow-visible rounded-[var(--radius-card)] border-0 bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
          : "relative grid size-9 shrink-0 cursor-pointer place-items-center overflow-visible rounded-full border-0 bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
      }
    >
      <span
        aria-hidden
        className={
          isTile
            ? "absolute inset-0 overflow-hidden rounded-[var(--radius-card)]"
            : "block size-5 rounded-full"
        }
        style={{
          ...preview,
          outline: selectedOutline,
          outlineOffset: isTile ? "0px" : "2px",
        }}
      />
      {showName ? (
        <span
          role="tooltip"
          className="pointer-events-none absolute -top-7 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold"
          style={{
            backgroundColor: "var(--color-btn)",
            color: "var(--color-btn-label)",
          }}
        >
          {label}
        </span>
      ) : null}
    </button>
  );
}

