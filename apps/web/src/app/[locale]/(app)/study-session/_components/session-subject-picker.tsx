"use client";

import { SubjectPicker } from "@/components/subject-picker";

export interface SessionSubjectPickerProps {
  value: string;
  onChange: (next: string) => void;
}

/** Pre-session subject selection on /study-session (roadmap §256). */
export function SessionSubjectPicker({ value, onChange }: SessionSubjectPickerProps) {
  return (
    <SubjectPicker
      value={value}
      onChange={onChange}
      layout="centered"
      translationNamespace="session"
    />
  );
}
