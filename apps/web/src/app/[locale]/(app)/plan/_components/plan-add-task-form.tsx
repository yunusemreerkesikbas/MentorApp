"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import { useTranslations } from "next-intl";
import { TextField } from "@mentor/ui";
import { FormError } from "@/components/form";
import {
  SubjectChipsSkeleton,
  TaskTitleFieldSkeleton,
} from "@/components/subject-picker";
import { useExamSubjectTaxonomy } from "@/lib/use-exam-subject-taxonomy";
import { PlanSubjectPicker } from "./plan-subject-picker";

export type PlanAddTaskFormHandle = {
  getValues: () => { title: string; subject: string };
  validate: () => boolean;
};

interface PlanAddTaskFormProps {
  initialTitle?: string;
  initialSubject?: string;
}

export const PlanAddTaskForm = forwardRef<PlanAddTaskFormHandle, PlanAddTaskFormProps>(
  function PlanAddTaskForm({ initialTitle = "", initialSubject = "" }: PlanAddTaskFormProps, ref) {
    const t = useTranslations("plan");
    const taxonomy = useExamSubjectTaxonomy();
    const [title, setTitle] = useState(initialTitle);
    const [subject, setSubject] = useState(initialSubject);
    const [error, setError] = useState<string | null>(null);

    useImperativeHandle(ref, () => ({
      getValues: () => ({ title, subject }),
      validate: () => {
        if (!taxonomy.loaded) return false;
        if (!title.trim()) {
          setError(t("task_required"));
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
        <PlanSubjectPicker
          value={subject}
          onChange={setSubject}
          taxonomy={taxonomy}
        />
      </div>
    );
  },
);
