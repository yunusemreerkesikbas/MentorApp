"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import { useTranslations } from "next-intl";
import { TextAreaField, TextField } from "@mentor/ui";
import { FormError } from "@/components/form";
import {
  SubjectChipsSkeleton,
  TaskTitleFieldSkeleton,
} from "@/components/subject-picker";
import { useExamSubjectTaxonomy } from "@/lib/use-exam-subject-taxonomy";
import { PlanSubjectPicker } from "./plan-subject-picker";

export type PlanTaskFormValues = {
  title: string;
  subject: string;
  /** null = all-day (the API's own convention). */
  startTime: string | null;
  endTime: string | null;
  description: string | null;
};

export type PlanAddTaskFormHandle = {
  getValues: () => PlanTaskFormValues;
  validate: () => boolean;
};

interface PlanAddTaskFormProps {
  initialTitle?: string;
  initialSubject?: string;
  initialStartTime?: string | null;
  initialEndTime?: string | null;
  initialDescription?: string | null;
}

/** Default block length when the user turns off "all day" without picking an end. */
function plusOneHour(start: string): string {
  const [h, m] = start.split(":").map(Number);
  return `${String(Math.min(23, (h ?? 0) + 1)).padStart(2, "0")}:${String(m ?? 0).padStart(2, "0")}`;
}

export const PlanAddTaskForm = forwardRef<PlanAddTaskFormHandle, PlanAddTaskFormProps>(
  function PlanAddTaskForm(
    {
      initialTitle = "",
      initialSubject = "",
      initialStartTime = null,
      initialEndTime = null,
      initialDescription = null,
    }: PlanAddTaskFormProps,
    ref,
  ) {
    const t = useTranslations("plan");
    const taxonomy = useExamSubjectTaxonomy();
    const [title, setTitle] = useState(initialTitle);
    const [subject, setSubject] = useState(initialSubject);
    const [allDay, setAllDay] = useState(!initialStartTime);
    const [startTime, setStartTime] = useState(initialStartTime ?? "09:00");
    const [endTime, setEndTime] = useState(
      initialEndTime ?? plusOneHour(initialStartTime ?? "09:00"),
    );
    const [description, setDescription] = useState(initialDescription ?? "");
    const [error, setError] = useState<string | null>(null);

    useImperativeHandle(ref, () => ({
      getValues: () => ({
        title,
        subject,
        startTime: allDay ? null : startTime,
        endTime: allDay || !endTime ? null : endTime,
        description: description.trim() ? description.trim() : null,
      }),
      validate: () => {
        if (!taxonomy.loaded) return false;
        if (!title.trim()) {
          setError(t("task_required"));
          return false;
        }
        if (!allDay && endTime && endTime <= startTime) {
          setError(t("time_invalid"));
          return false;
        }
        setError(null);
        return true;
      },
    }));

    if (!taxonomy.loaded) {
      return (
        <div className="flex flex-col gap-3">
          <TaskTitleFieldSkeleton loadingLabel={t("loading")} />
          <SubjectChipsSkeleton
            layout="stacked"
            pickLabel={t("subject_pick_label")}
            loadingLabel={t("loading")}
          />
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-3">
        <FormError message={error} />
        <TextField
          label={t("new_task")}
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (error) setError(null);
          }}
          placeholder={t("task_placeholder")}
          maxLength={200}
          required
        />

        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={allDay}
            onChange={(e) => {
              setAllDay(e.target.checked);
              if (error) setError(null);
            }}
            className="h-5 w-5 cursor-pointer rounded-[6px]"
            style={{ accentColor: "var(--color-progress)" }}
          />
          <span style={{ color: "var(--color-main)" }}>{t("all_day")}</span>
        </label>

        {!allDay ? (
          <div className="flex items-end gap-3">
            {/* Native time input: no picker dependency, and it gets the platform keyboard. */}
            <TextField
              type="time"
              className="flex-1"
              label={t("time_start")}
              value={startTime}
              onChange={(e) => {
                const next = e.target.value;
                setStartTime(next);
                if (next && endTime && endTime <= next) setEndTime(plusOneHour(next));
                if (error) setError(null);
              }}
              required
            />
            <TextField
              type="time"
              className="flex-1"
              label={t("time_end")}
              value={endTime}
              onChange={(e) => {
                setEndTime(e.target.value);
                if (error) setError(null);
              }}
            />
          </div>
        ) : null}

        <PlanSubjectPicker
          value={subject}
          onChange={setSubject}
          taxonomy={taxonomy}
        />

        <TextAreaField
          label={t("description")}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("description_placeholder")}
          maxLength={2000}
          rows={3}
        />
      </div>
    );
  },
);
