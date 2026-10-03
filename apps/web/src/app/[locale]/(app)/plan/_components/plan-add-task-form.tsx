"use client";

import { forwardRef, useEffect, useId, useImperativeHandle, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { CheckBox, Skeleton, TextAreaField, TextField, skeletonStaggerStyle } from "@mentor/ui";
import { studyDurationMinutesSchema } from "@mentor/validation";
import { SESSION_FOCUS_MINUTES_MIN, SESSION_FOCUS_MINUTES_MAX, SESSION_FOCUS_MINUTES_STEP } from "@mentor/types";
import { FormError } from "@/components/form";
import {
  SubjectChipsSkeleton,
  TaskTitleFieldSkeleton,
} from "@/components/subject-picker";
import { useExamSubjectTaxonomy } from "@/lib/use-exam-subject-taxonomy";
import { PlanSubjectPicker } from "./plan-subject-picker";
import { PlanTimeField } from "./plan-time-field";
import { canonicalHm } from "./plan-time";
import { Link } from "@/i18n/navigation";
import { loadAnalysisPlanFocus, validAnalysisTaskDate, type AnalysisFocusRefs } from "@/lib/analysis-plan-focus";

export type PlanTaskFormValues = {
  taskDate?: string;
  title: string;
  subject: string;
  /** null = all-day (the API's own convention). */
  startTime: string | null;
  endTime: string | null;
  description: string | null;
  durationMinutes: number | null;
};

export type PlanAddTaskFormHandle = {
  getValues: () => PlanTaskFormValues;
  validate: () => boolean;
  showSubmissionError: (message: string, focusChanged: boolean) => void;
};

interface PlanAddTaskFormProps {
  initialTitle?: string;
  initialSubject?: string;
  initialStartTime?: string | null;
  initialEndTime?: string | null;
  initialDescription?: string | null;
  initialDurationMinutes?: number | null;
  lockedFocus?: { subjectName: string; topicName?: string };
  initialTaskDate?: string;
  analysisFocus?: AnalysisFocusRefs;
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
      initialDurationMinutes = null,
      lockedFocus,
      initialTaskDate,
      analysisFocus,
    }: PlanAddTaskFormProps,
    ref,
  ) {
    const t = useTranslations("plan");
    const reduceMotion = useReducedMotion();
    const allDayId = useId();
    const allDayLabelId = useId();
    const taxonomy = useExamSubjectTaxonomy();
    const [title, setTitle] = useState(initialTitle);
    const [taskDate, setTaskDate] = useState(initialTaskDate);
    const [subject, setSubject] = useState(initialSubject);
    const [allDay, setAllDay] = useState(!initialStartTime);
    const [startTime, setStartTime] = useState(initialStartTime ?? "09:00");
    const [endTime, setEndTime] = useState(
      initialEndTime ?? plusOneHour(initialStartTime ?? "09:00"),
    );
    const [description, setDescription] = useState(initialDescription ?? "");
    const [duration, setDuration] = useState(initialDurationMinutes?.toString() ?? "");
    const [error, setError] = useState<string | null>(null);
    const [focusChanged, setFocusChanged] = useState(false);
    const [verifiedFocus, setVerifiedFocus] = useState<typeof lockedFocus>();
    const examId = analysisFocus?.examId;
    const subjectRef = analysisFocus?.subjectRef;
    const topicRef = analysisFocus?.topicRef;
    useEffect(() => {
      if (!examId || !subjectRef) return;
      let active = true;
      loadAnalysisPlanFocus({ examId, subjectRef, topicRef }).then((focus) => {
        if (active) setVerifiedFocus(focus);
      }).catch(() => {
        if (active) { setError(t("analysis_focus_unavailable")); setFocusChanged(true); }
      });
      return () => { active = false; };
    }, [examId, subjectRef, topicRef, t]);
    const displayFocus = analysisFocus ? verifiedFocus : lockedFocus;

    useImperativeHandle(ref, () => ({
      getValues: () => ({
        ...(taskDate && { taskDate }),
        title,
        durationMinutes: duration === "" ? null : Number(duration),
        subject: displayFocus?.subjectName ?? subject,
        startTime: allDay ? null : (canonicalHm(startTime) ?? startTime),
        endTime: allDay || !endTime.trim() ? null : (canonicalHm(endTime) ?? endTime),
        description: description.trim() ? description.trim() : null,
      }),
      validate: () => {
        if (analysisFocus && (!verifiedFocus || focusChanged)) return false;
        if (!taxonomy.loaded) return false;
        if (initialTaskDate && !validAnalysisTaskDate(taskDate, new Date().toISOString().slice(0, 10))) {
          setError(t("analysis_date_required"));
          return false;
        }
        if (duration !== "" && !studyDurationMinutesSchema.safeParse(Number(duration)).success) {
          setError(t("duration_invalid"));
          return false;
        }
        if (!title.trim()) {
          setError(t("task_required"));
          return false;
        }
        if (!allDay) {
          const start = canonicalHm(startTime);
          const end = endTime.trim() ? canonicalHm(endTime) : null;
          if (!start || (endTime.trim() && !end) || (end && end <= start)) {
            setError(t("time_invalid"));
            return false;
          }
        }
        setError(null);
        return true;
      },
      showSubmissionError: (message, changed) => { setError(message); setFocusChanged(changed); },
    }));

    if (!taxonomy.loaded) {
      return (
        <div className="flex flex-col gap-3">
          <TaskTitleFieldSkeleton loadingLabel={t("loading")} />
          <Skeleton className="h-11 w-28 rounded-[var(--radius-card)]" style={skeletonStaggerStyle(2)} />
          <SubjectChipsSkeleton
            layout="stacked"
            pickLabel={t("subject_pick_label")}
            loadingLabel={t("loading")}
          />
          <Skeleton className="h-11 w-36 rounded-[var(--radius-card)]" style={skeletonStaggerStyle(3)} />
          <Skeleton className="h-24 w-full rounded-[var(--radius-card)]" style={skeletonStaggerStyle(4)} />
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-3">
        <FormError message={error} />
        {focusChanged ? <Link href={{ pathname: "/analysis", query: { tab: "progress" } }} className="min-h-11 text-sm font-semibold underline">{t("analysis_return")}</Link> : null}
        {initialTaskDate ? (
          <TextField type="date" label={t("analysis_task_date")} value={taskDate ?? ""} min={new Date().toISOString().slice(0, 10)} onChange={(event) => setTaskDate(event.target.value)} required />
        ) : null}
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

        <label htmlFor={allDayId} className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium">
          <CheckBox
            id={allDayId}
            className="t-check-accent"
            checked={allDay}
            aria-labelledby={allDayLabelId}
            onChange={(checked) => {
              setAllDay(checked);
              if (error) setError(null);
            }}
          />
          <span id={allDayLabelId} style={{ color: "var(--color-main)" }}>{t("all_day")}</span>
        </label>

        <AnimatePresence initial={false}>
          {!allDay ? (
            <motion.div
              key="task-times"
              initial={reduceMotion ? false : { height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={
                reduceMotion
                  ? { opacity: 0, transition: { duration: 0.15 } }
                  : {
                      height: 0,
                      opacity: 0,
                      transition: { duration: 0.15, ease: [0.22, 1, 0.36, 1] as const },
                    }
              }
              transition={
                reduceMotion
                  ? { duration: 0.15 }
                  : { duration: 0.25, ease: [0.22, 1, 0.36, 1] as const }
              }
              className="overflow-hidden"
            >
              <div className="flex items-end gap-3 px-0.5 py-0.5">
                <PlanTimeField
                  label={t("time_start")}
                  value={startTime}
                  required
                  onChange={(next) => {
                    setStartTime(next);
                    const start = canonicalHm(next);
                    const end = canonicalHm(endTime);
                    if (start && end && end <= start) setEndTime(plusOneHour(start));
                    if (error) setError(null);
                  }}
                />
                <PlanTimeField
                  label={t("time_end")}
                  value={endTime}
                  onChange={(next) => {
                    setEndTime(next);
                    if (error) setError(null);
                  }}
                />
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {analysisFocus || lockedFocus ? (
          <div
            className="rounded-[var(--radius-card)] border px-4 py-3"
            style={{
              borderColor: "var(--color-border)",
              backgroundColor: "var(--color-surface-container)",
            }}
            aria-label={t("analysis_focus_locked")}
          >
            <p className="text-xs font-semibold" style={{ color: "var(--color-secondary)" }}>
              {t("analysis_focus_locked")}
            </p>
            <p className="mt-1 text-sm font-bold" style={{ color: "var(--color-main)" }}>
              {displayFocus?.subjectName ?? t("loading")}
              {displayFocus?.topicName ? ` · ${displayFocus.topicName}` : ""}
            </p>
          </div>
        ) : (
          <PlanSubjectPicker
            value={subject}
            onChange={setSubject}
            taxonomy={taxonomy}
          />
        )}

        <TextField
          type="number"
          label={t("duration_label")}
          className="max-w-full self-start flex-row flex-wrap items-center gap-x-3 gap-y-1 [&>div]:w-36 [&_input]:[appearance:textfield] [&_input::-webkit-outer-spin-button]:appearance-none [&_input::-webkit-inner-spin-button]:appearance-none"
          dense
          value={duration}
          min={SESSION_FOCUS_MINUTES_MIN}
          max={SESSION_FOCUS_MINUTES_MAX}
          step={SESSION_FOCUS_MINUTES_STEP}
          placeholder={t("duration_optional")}
          onChange={(event) => { setDuration(event.target.value); if (error) setError(null); }}
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
