"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { AuthUser, ExamCalendarDto, ExamSubjectDto } from "@mentor/types";
import {
  contentControllerCalendarByFamily,
  contentControllerSubjectsBySlug,
  usersControllerMe,
} from "@mentor/api-client";
import { Chip, TextField } from "@mentor/ui";
import { Link } from "@/i18n/navigation";

export interface SessionSubjectPickerProps {
  value: string;
  onChange: (next: string) => void;
}

/**
 * Pre-session subject selection (roadmap §256) — mirrors the plan add-task picker so a session
 * started directly on /seans still carries a subject. Falls back to free text when the user has no
 * exam type or the taxonomy is empty. Fetches only while rendered (i.e. no subject picked yet).
 */
export function SessionSubjectPicker({ value, onChange }: SessionSubjectPickerProps) {
  const t = useTranslations("session");
  const [subjects, setSubjects] = useState<ExamSubjectDto[]>([]);
  const [needsExamType, setNeedsExamType] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const me = (await usersControllerMe()) as unknown as AuthUser;
        if (!active) return;
        if (!me.examType) {
          setNeedsExamType(true);
          setLoaded(true);
          return;
        }
        const calendar = (await contentControllerCalendarByFamily(
          me.examType,
        )) as unknown as ExamCalendarDto | null;
        const exam = calendar?.exam ?? null;
        if (!active) return;
        if (!exam) {
          setLoaded(true);
          return;
        }
        const rows = (await contentControllerSubjectsBySlug(
          exam.slug,
        )) as unknown as ExamSubjectDto[];
        if (!active) return;
        setSubjects(rows);
        setLoaded(true);
      } catch {
        if (!active) return;
        setLoaded(true);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  if (!loaded) {
    return (
      <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
        {t("subject_loading")}
      </p>
    );
  }

  if (needsExamType) {
    return (
      <div className="flex w-full flex-col gap-2">
        <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
          {t("subject_pick_hint")}
        </p>
        <Link
          href="/profil"
          className="text-sm font-semibold"
          style={{ color: "var(--color-progress)" }}
        >
          {t("subject_pick_cta")}
        </Link>
        <TextField
          label={t("subject_pick_label")}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t("subject_placeholder")}
          maxLength={80}
        />
      </div>
    );
  }

  if (subjects.length === 0) {
    return (
      <div className="w-full">
        <TextField
          label={t("subject_pick_label")}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t("subject_placeholder")}
          maxLength={80}
        />
      </div>
    );
  }

  return (
    <div
      className="flex w-full flex-wrap justify-center gap-2"
      role="group"
      aria-label={t("subject_pick_label")}
    >
      {subjects.map((subject) => {
        const selected = value === subject.name;
        return (
          <button
            key={subject.slug}
            type="button"
            onClick={() => onChange(selected ? "" : subject.name)}
            className="cursor-pointer rounded-[var(--radius-card)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
            aria-pressed={selected}
          >
            <Chip
              className={`px-3 py-1.5 text-xs font-bold uppercase ${selected ? "ring-2 ring-[var(--color-main)] ring-offset-1" : ""}`}
            >
              {subject.name}
            </Chip>
          </button>
        );
      })}
    </div>
  );
}
