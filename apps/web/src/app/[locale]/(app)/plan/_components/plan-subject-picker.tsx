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

export function PlanSubjectPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const t = useTranslations("plan");
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
        {t("loading")}
      </p>
    );
  }

  if (needsExamType) {
    return (
      <div className="flex flex-col gap-2">
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
          label={t("subject")}
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
      <TextField
        label={t("subject")}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("subject_placeholder")}
        maxLength={80}
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <span
        className="text-sm font-medium"
        style={{ color: "var(--color-body)", fontFamily: "var(--font-body)" }}
      >
        {t("subject_pick_label")}
      </span>
      <div className="flex flex-wrap gap-2">
        {subjects.map((subject) => {
          const selected = value === subject.name;
          return (
            <button
              key={subject.slug}
              type="button"
              onClick={() => onChange(selected ? "" : subject.name)}
              className="rounded-[var(--radius-card)] focus-visible:outline-none focus-visible:ring-2"
              aria-pressed={selected}
            >
              <Chip
                className={`cursor-pointer px-3 py-1 text-xs font-bold uppercase ${selected ? "ring-2 ring-[var(--color-progress)]" : ""}`}
              >
                {subject.name}
              </Chip>
            </button>
          );
        })}
      </div>
    </div>
  );
}
