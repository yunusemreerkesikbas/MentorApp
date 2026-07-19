"use client";

import { useTranslations } from "next-intl";
import { Chip, TextField } from "@mentor/ui";
import { Link } from "@/i18n/navigation";
import { useExamSubjectTaxonomy } from "@/lib/use-exam-subject-taxonomy";

export type SubjectPickerNamespace = "plan" | "session";
export type SubjectPickerLayout = "centered" | "stacked";

export interface SubjectPickerProps {
  value: string;
  onChange: (next: string) => void;
  layout: SubjectPickerLayout;
  translationNamespace: SubjectPickerNamespace;
}

function useSubjectPickerLabels(namespace: SubjectPickerNamespace) {
  const t = useTranslations(namespace);
  if (namespace === "plan") {
    return {
      loading: t("loading"),
      fieldLabel: t("subject"),
      pickLabel: t("subject_pick_label"),
      hint: t("subject_pick_hint"),
      cta: t("subject_pick_cta"),
      placeholder: t("subject_placeholder"),
    };
  }
  return {
    loading: t("subject_loading"),
    fieldLabel: t("subject_pick_label"),
    pickLabel: t("subject_pick_label"),
    hint: t("subject_pick_hint"),
    cta: t("subject_pick_cta"),
    placeholder: t("subject_placeholder"),
  };
}

/**
 * Shared exam-subject picker — taxonomy chips when available, free text otherwise.
 * Used by plan add-task sheet and pre-session setup on /study-session.
 */
export function SubjectPicker({
  value,
  onChange,
  layout,
  translationNamespace,
}: SubjectPickerProps) {
  const labels = useSubjectPickerLabels(translationNamespace);
  const { subjects, needsExamType, loaded } = useExamSubjectTaxonomy();

  if (!loaded) {
    return (
      <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
        {labels.loading}
      </p>
    );
  }

  if (needsExamType) {
    return (
      <div className="flex w-full flex-col gap-2">
        <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
          {labels.hint}
        </p>
        <Link
          href="/profile"
          className="text-sm font-semibold"
          style={{ color: "var(--color-progress)" }}
        >
          {labels.cta}
        </Link>
        <TextField
          label={labels.fieldLabel}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={labels.placeholder}
          maxLength={80}
        />
      </div>
    );
  }

  if (subjects.length === 0) {
    return (
      <div className={layout === "centered" ? "w-full" : undefined}>
        <TextField
          label={labels.fieldLabel}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={labels.placeholder}
          maxLength={80}
        />
      </div>
    );
  }

  const chipList = (
    <>
      {subjects.map((subject) => {
        const selected = value === subject.name;
        const chipClass =
          layout === "centered"
            ? `px-3 py-1.5 text-xs font-bold uppercase ${selected ? "ring-2 ring-[var(--color-main)] ring-offset-1" : ""}`
            : `cursor-pointer px-3 py-1 text-xs font-bold uppercase ${selected ? "ring-2 ring-[var(--color-progress)]" : ""}`;
        const buttonClass =
          layout === "centered"
            ? "cursor-pointer rounded-[var(--radius-card)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
            : "rounded-[var(--radius-card)] focus-visible:outline-none focus-visible:ring-2";

        return (
          <button
            key={subject.slug}
            type="button"
            onClick={() => onChange(selected ? "" : subject.name)}
            className={buttonClass}
            aria-pressed={selected}
          >
            <Chip className={chipClass}>{subject.name}</Chip>
          </button>
        );
      })}
    </>
  );

  if (layout === "centered") {
    return (
      <div
        className="flex w-full flex-wrap justify-center gap-2"
        role="group"
        aria-label={labels.pickLabel}
      >
        {chipList}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <span
        className="text-sm font-medium"
        style={{ color: "var(--color-body)", fontFamily: "var(--font-body)" }}
      >
        {labels.pickLabel}
      </span>
      <div className="flex flex-wrap gap-2">{chipList}</div>
    </div>
  );
}
