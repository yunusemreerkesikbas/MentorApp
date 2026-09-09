"use client";

import type { PlanEventMutationScope } from "@mentor/types";
import { useTranslations } from "next-intl";

export function CoachPlanEventScopeChoices({
  value,
  disabled,
  onChange,
}: {
  value: PlanEventMutationScope | null;
  disabled?: boolean;
  onChange: (scope: PlanEventMutationScope) => void;
}) {
  const t = useTranslations("coachPlan");
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-semibold" style={{ color: "var(--color-main)" }}>
        {t("event_scope")}
      </legend>
      {(["OCCURRENCE", "SERIES"] as const).map((scope) => (
        <label
          key={scope}
          className="flex min-h-11 items-center gap-3 rounded-[var(--radius-card)] border px-3"
          style={{ borderColor: "var(--color-border)", color: "var(--color-body)" }}
        >
          <input
            type="radio"
            name="event-scope"
            value={scope}
            checked={value === scope}
            disabled={disabled}
            onChange={() => onChange(scope)}
            className="size-5 accent-[var(--color-btn)]"
          />
          {t(scope === "OCCURRENCE" ? "scope_occurrence" : "scope_series")}
        </label>
      ))}
    </fieldset>
  );
}
