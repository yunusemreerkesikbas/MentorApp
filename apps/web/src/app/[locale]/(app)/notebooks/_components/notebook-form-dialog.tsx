"use client";

import { useId, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import type {
  ExamSubjectDto,
  NotebookCoverColor,
  NotebookCoverMaterial,
  NotebookDto,
  NotebookSummaryDto,
} from "@mentor/types";
import { NOTEBOOK_COVER_COLORS, NOTEBOOK_COVER_MATERIALS } from "@mentor/types";
import { Button } from "@mentor/ui";
import { MenuSelect } from "@/components/menu-select";
import {
  COVER_COLORS,
  COVER_MATERIALS,
} from "@/components/notebook/notebook-surface";
import "@fontsource-variable/fraunces/soft.css";
import "@fontsource-variable/caveat/wght.css";
import "@/components/notebook-desk/notebook-desk.css";
import { createNotebook, updateNotebook } from "@/lib/notebook";

interface ExamChoice {
  id: string;
  subjects: ExamSubjectDto[];
}

const DEFAULT_COVER = { color: "navy", material: "cloth" } as const;

/** Where the paper card turns into a bottom sheet; matches `.nb-form` in notebook-desk.css. */
const SHEET_QUERY = "(max-width: 639px)";

/**
 * Create/edit form for a notebook: ruled paper taped over the desk, with the cover it makes
 * beside the fields (the "Defterlerim" design canvas). A bottom sheet on phones. Native
 * `<dialog>` so it takes the top layer and the select's menu portals into it.
 */
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
  const colorLabelId = `notebook-color-${reactId}`;
  const materialLabelId = `notebook-material-${reactId}`;
  const headingId = `notebook-form-title-${reactId}`;
  const titleInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pressOnScrimRef = useRef(false);
  const reduceMotion = useReducedMotion();
  const [closing, setClosing] = useState(false);
  // Read once at open, like the kit Modal: the entrance follows the layout it opened in.
  const [sheet] = useState(
    () => typeof window !== "undefined" && window.matchMedia(SHEET_QUERY).matches,
  );
  const hidden = sheet ? { opacity: 1, y: "100%", rotate: 0 } : { opacity: 0, y: 40, rotate: 2 };
  const shown = sheet ? { opacity: 1, y: 0, rotate: 0 } : { opacity: 1, y: 0, rotate: -1 };
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

  useLayoutEffect(() => {
    const node = dialogRef.current;
    if (!node || node.open) return;
    node.showModal();
    titleInputRef.current?.focus();
  }, []);

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

  function requestClose() {
    if (!saving && !closing) setClosing(true);
  }

  return (
    <motion.dialog
      ref={dialogRef}
      className="nb-form"
      aria-labelledby={headingId}
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
      onPointerDown={(event) => {
        pressOnScrimRef.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (pressOnScrimRef.current && event.target === event.currentTarget) requestClose();
      }}
      initial={reduceMotion ? false : hidden}
      animate={closing ? hidden : shown}
      transition={{
        duration: reduceMotion ? 0 : closing ? 0.15 : sheet ? 0.3 : 0.46,
        ease: closing ? [0.22, 1, 0.36, 1] : [0.2, 0.9, 0.25, 1.05],
      }}
      onAnimationComplete={() => {
        if (closing) onClose();
      }}
    >
      <div className="nb-form-tape" aria-hidden />
      <form className="nb-form-body" onSubmit={(event) => void submit(event)}>
        <div className="nb-form-handle" aria-hidden />
        <h2 id={headingId} className="nb-form-title">
          {current ? t("edit_title") : t("create_title")}
        </h2>
        <div className="nb-form-row">
          <div className="nb-form-main">
            <label className="nb-form-label" htmlFor={titleInputId}>
              {t("title_label")}
            </label>
            <input
              id={titleInputId}
              ref={titleInputRef}
              className="nb-form-input"
              type="text"
              disabled={saving}
              required
              minLength={1}
              maxLength={40}
              autoComplete="off"
              placeholder={t("title_placeholder")}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
            <span id={subjectLabelId} className="nb-form-label">
              {t("subject_label")}
            </span>
            <MenuSelect
              value={subjectRef}
              disabled={saving || subjects.length === 0}
              aria-labelledby={subjectLabelId}
              options={[
                { value: "", label: t("subject_none") },
                ...subjects.map((subject) => ({ value: subject.slug, label: subject.name })),
              ]}
              onChange={setSubjectRef}
            />
            <span id={colorLabelId} className="nb-form-label">
              {t("color_label")}
            </span>
            <div className="nb-form-swatches" role="group" aria-labelledby={colorLabelId}>
              {NOTEBOOK_COVER_COLORS.map((value) => (
                <button
                  key={value}
                  type="button"
                  className="nb-form-swatch"
                  aria-label={notebookT(`cover_color.${value}`)}
                  aria-pressed={color === value}
                  disabled={saving}
                  style={{ backgroundColor: COVER_COLORS[value] }}
                  onClick={() => setColor(value)}
                />
              ))}
            </div>
            <span id={materialLabelId} className="nb-form-label">
              {t("material_label")}
            </span>
            <div className="nb-form-mats" role="group" aria-labelledby={materialLabelId}>
              {NOTEBOOK_COVER_MATERIALS.map((value) => (
                <button
                  key={value}
                  type="button"
                  className="nb-form-mat"
                  aria-pressed={material === value}
                  disabled={saving}
                  onClick={() => setMaterial(value)}
                >
                  {notebookT(`cover_material.${value}`)}
                </button>
              ))}
            </div>
          </div>
          <div className="nb-form-preview" aria-hidden>
            <div
              className="nb-form-mini"
              style={{
                backgroundColor: COVER_COLORS[color],
                backgroundImage: COVER_MATERIALS[material],
              }}
            >
              <div className="nb-form-mini-coil" />
              <div className="nb-form-mini-label">
                {title.trim() ? title : t("preview_title")}
              </div>
            </div>
          </div>
        </div>
        {error ? (
          <p role="alert" className="nb-form-error">
            {t("error")}
          </p>
        ) : null}
        <div className="nb-form-actions">
          <button
            type="button"
            className="nb-form-cancel"
            disabled={saving}
            onClick={requestClose}
          >
            {t("cancel")}
          </button>
          <Button type="submit" busy={saving} disabled={title.trim().length === 0}>
            {t("save")}
          </Button>
        </div>
      </form>
    </motion.dialog>
  );
}
