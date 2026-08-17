"use client";

import { useTranslations } from "next-intl";
import {
  Skeleton,
  SkeletonGroup,
  TextField,
  skeletonStaggerStyle,
} from "@mentor/ui";
import { Link } from "@/i18n/navigation";
import {
  useExamSubjectTaxonomy,
  type ExamSubjectTaxonomyState,
} from "@/lib/use-exam-subject-taxonomy";

export type SubjectPickerNamespace = "plan" | "session";
export type SubjectPickerLayout = "centered" | "stacked";

/** Varying pill widths ≈ typical KPSS subject chip row. */
const CHIP_SKELETON_WIDTHS = [
  "4.75rem",
  "5.75rem",
  "3.75rem",
  "4.5rem",
  "6.25rem",
  "7rem",
] as const;

export interface SubjectPickerProps {
  value: string;
  onChange: (next: string) => void;
  layout: SubjectPickerLayout;
  translationNamespace: SubjectPickerNamespace;
  /** When provided, skips the internal taxonomy fetch (shared with parent form). */
  taxonomy?: ExamSubjectTaxonomyState;
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

export function SubjectChipsSkeleton({
  layout,
  pickLabel,
  loadingLabel,
}: {
  layout: SubjectPickerLayout;
  pickLabel: string;
  loadingLabel: string;
}) {
  const chips = (
    <SkeletonGroup
      label={loadingLabel}
      className={`flex flex-wrap gap-2 ${layout === "centered" ? "justify-center" : ""}`}
    >
      {CHIP_SKELETON_WIDTHS.map((width, index) => (
        <Skeleton
          key={width}
          className="h-9 rounded-full"
          style={{ width, ...skeletonStaggerStyle(index) }}
        />
      ))}
    </SkeletonGroup>
  );

  if (layout === "centered") {
    return <div className="w-full min-h-[5.5rem]">{chips}</div>;
  }

  return (
    <div className="flex min-h-[6.75rem] flex-col gap-2">
      <Skeleton
        className="h-4 w-12 rounded-[var(--radius-card)]"
        style={skeletonStaggerStyle(0)}
      />
      <span className="sr-only">{pickLabel}</span>
      {chips}
    </div>
  );
}

export function TaskTitleFieldSkeleton({ loadingLabel }: { loadingLabel: string }) {
  return (
    <SkeletonGroup label={loadingLabel} className="flex flex-col gap-2">
      <Skeleton
        className="h-4 w-20 rounded-[var(--radius-card)]"
        style={skeletonStaggerStyle(0)}
      />
      <Skeleton
        className="h-11 w-full rounded-[var(--radius-card)]"
        style={skeletonStaggerStyle(1)}
      />
    </SkeletonGroup>
  );
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
  taxonomy: taxonomyProp,
}: SubjectPickerProps) {
  const labels = useSubjectPickerLabels(translationNamespace);
  const internal = useExamSubjectTaxonomy();
  const { subjects, needsExamType, loaded } = taxonomyProp ?? internal;

  if (!loaded) {
    return (
      <SubjectChipsSkeleton
        layout={layout}
        pickLabel={labels.pickLabel}
        loadingLabel={labels.loading}
      />
    );
  }

  if (needsExamType) {
    return (
      <div className="flex w-full flex-col gap-2">
        <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
          {labels.hint}
        </p>
        <Link
          href="/settings"
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

  const chipList = subjects.map((subject) => {
    const selected = value === subject.name;
    return (
      <button
        key={subject.slug}
        type="button"
        onClick={() => onChange(selected ? "" : subject.name)}
        aria-pressed={selected}
        className="cursor-pointer rounded-full px-3.5 py-2 text-xs font-bold tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
        style={{
          fontFamily: "var(--font-body)",
          backgroundColor: selected ? "var(--color-accent)" : "var(--color-surface)",
          color: selected ? "#fff" : "var(--color-main)",
          border: selected
            ? "1px solid var(--color-accent)"
            : "1px solid color-mix(in srgb, var(--color-main) 12%, transparent)",
        }}
      >
        {subject.name}
      </button>
    );
  });

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
      <div className="flex flex-wrap gap-2" role="group" aria-label={labels.pickLabel}>
        {chipList}
      </div>
    </div>
  );
}
