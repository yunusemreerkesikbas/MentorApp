"use client";

import { SubjectPicker } from "@/components/subject-picker";

export function PlanSubjectPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <SubjectPicker
      value={value}
      onChange={onChange}
      layout="stacked"
      translationNamespace="plan"
    />
  );
}
