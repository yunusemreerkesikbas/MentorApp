"use client";

import { SubjectPicker } from "@/components/subject-picker";
import type { ExamSubjectTaxonomyState } from "@/lib/use-exam-subject-taxonomy";

export function PlanSubjectPicker({
  value,
  onChange,
  taxonomy,
}: {
  value: string;
  onChange: (next: string) => void;
  taxonomy?: ExamSubjectTaxonomyState;
}) {
  return (
    <SubjectPicker
      value={value}
      onChange={onChange}
      layout="stacked"
      translationNamespace="plan"
      taxonomy={taxonomy}
    />
  );
}
