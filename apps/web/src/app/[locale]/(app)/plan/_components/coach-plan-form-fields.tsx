"use client";

import type { SelectHTMLAttributes } from "react";
import { TextField } from "@mentor/ui";
import { useTranslations } from "next-intl";

export function CoachPlanTimeFields({
  startTime,
  endTime,
  disabled,
  onStartTime,
  onEndTime,
}: {
  startTime: string;
  endTime: string;
  disabled?: boolean;
  onStartTime: (value: string) => void;
  onEndTime: (value: string) => void;
}) {
  const t = useTranslations("coachPlan");
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <TextField
        type="time"
        label={t("start_time")}
        value={startTime}
        disabled={disabled}
        onChange={(event) => onStartTime(event.target.value)}
      />
      <TextField
        type="time"
        label={t("end_time")}
        value={endTime}
        disabled={disabled}
        onChange={(event) => onEndTime(event.target.value)}
      />
    </div>
  );
}

export function CoachPlanSelect({
  label,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span
        className="text-xs font-semibold"
        style={{ color: "var(--color-secondary)" }}
      >
        {label}
      </span>
      <select
        {...props}
        className="min-h-11 rounded-[var(--radius-card)] border bg-[var(--color-surface-translucent)] px-4 py-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        style={{
          color: "var(--color-body)",
          borderColor: "var(--color-border)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        {children}
      </select>
    </label>
  );
}
