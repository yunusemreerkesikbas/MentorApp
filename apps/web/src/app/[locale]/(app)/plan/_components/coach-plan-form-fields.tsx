"use client";

import { useId } from "react";
import { TextField } from "@mentor/ui";
import { useTranslations } from "next-intl";
import { DateField } from "@/components/date-field";
import { MenuSelect, type MenuSelectOption } from "@/components/menu-select";
import { TimeField } from "@/components/time-field";

export function CoachPlanWhenFields({
  date,
  minDate,
  dateDisabled,
  startTime,
  endTime,
  disabled,
  onDate,
  onStartTime,
  onEndTime,
}: {
  date: string;
  minDate?: string;
  dateDisabled?: boolean;
  startTime: string;
  endTime: string;
  disabled?: boolean;
  onDate: (value: string) => void;
  onStartTime: (value: string) => void;
  onEndTime: (value: string) => void;
}) {
  const t = useTranslations("coachPlan");
  return (
    <div className="grid grid-cols-3 gap-3">
      <DateField
        label={t("form_date")}
        value={date}
        min={minDate}
        required
        disabled={disabled || dateDisabled}
        onChange={onDate}
      />
      <TimeField
        label={t("start_time")}
        value={startTime}
        disabled={disabled}
        onChange={onStartTime}
      />
      <TimeField
        label={t("end_time")}
        value={endTime}
        disabled={disabled}
        onChange={onEndTime}
      />
    </div>
  );
}

export function CoachPlanRecurrenceFields({
  frequency,
  frequencies,
  endKind,
  count,
  endDate,
  minEndDate,
  disabled,
  onFrequency,
  onEndKind,
  onCount,
  onEndDate,
}: {
  frequency: string;
  frequencies: readonly string[];
  endKind: "COUNT" | "DATE";
  count: number;
  endDate: string;
  minEndDate: string;
  disabled?: boolean;
  onFrequency: (value: string) => void;
  onEndKind: (value: "COUNT" | "DATE") => void;
  onCount: (value: number) => void;
  onEndDate: (value: string) => void;
}) {
  const t = useTranslations("coachPlan");
  return (
    <div className="grid grid-cols-3 gap-3">
      <CoachPlanMenuField
        label={t("recurrence")}
        value={frequency}
        disabled={disabled}
        onChange={onFrequency}
        options={frequencies.map((item) => ({
          value: item,
          label: t(`recurrence_${item.toLowerCase()}`),
        }))}
      />
      {frequency !== "NONE" ? (
        <>
          <CoachPlanMenuField
            label={t("recurrence_end")}
            value={endKind}
            disabled={disabled}
            onChange={(next) => onEndKind(next as "COUNT" | "DATE")}
            options={[
              { value: "COUNT", label: t("recurrence_count") },
              { value: "DATE", label: t("recurrence_date") },
            ]}
          />
          {endKind === "COUNT" ? (
            <TextField
              type="number"
              dense
              label={t("recurrence_count_label")}
              value={count}
              min={2}
              max={100}
              required
              disabled={disabled}
              onChange={(event) => onCount(event.target.valueAsNumber)}
            />
          ) : (
            <DateField
              label={t("recurrence_end_date")}
              value={endDate}
              min={minEndDate}
              required
              disabled={disabled}
              onChange={onEndDate}
            />
          )}
        </>
      ) : null}
    </div>
  );
}

export function CoachPlanMenuField({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly MenuSelectOption[];
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const labelId = useId();
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span
        id={labelId}
        className="text-xs font-semibold"
        style={{ color: "var(--color-secondary)" }}
      >
        {label}
      </span>
      <MenuSelect
        value={value}
        options={options}
        disabled={disabled}
        textSize="sm"
        menuSide="top"
        aria-labelledby={labelId}
        onChange={onChange}
      />
    </div>
  );
}
