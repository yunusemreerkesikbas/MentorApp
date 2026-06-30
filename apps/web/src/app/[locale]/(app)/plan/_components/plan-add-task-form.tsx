"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import { useTranslations } from "next-intl";
import { TextField } from "@mentor/ui";
import { FormError } from "@/components/form";
import { PlanSubjectPicker } from "./plan-subject-picker";

export type PlanAddTaskFormHandle = {
  getValues: () => { title: string; subject: string };
  validate: () => boolean;
};

export const PlanAddTaskForm = forwardRef<PlanAddTaskFormHandle>(
  function PlanAddTaskForm(_props, ref) {
    const t = useTranslations("plan");
    const [title, setTitle] = useState("");
    const [subject, setSubject] = useState("");
    const [error, setError] = useState<string | null>(null);

    useImperativeHandle(ref, () => ({
      getValues: () => ({ title, subject }),
      validate: () => {
        if (!title.trim()) {
          setError(t("task_required"));
          return false;
        }
        setError(null);
        return true;
      },
    }));

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
        <PlanSubjectPicker value={subject} onChange={setSubject} />
      </div>
    );
  },
);
