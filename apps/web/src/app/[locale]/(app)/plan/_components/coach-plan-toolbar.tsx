"use client";

import { useTranslations } from "next-intl";

export function CoachPlanToolbar() {
  const t = useTranslations("coachPlan");

  return (
    <header className="shrink-0">
      <h1 className="text-2xl font-bold" style={{ color: "var(--color-main)" }}>
        {t("title")}
      </h1>
      <p className="mt-1" style={{ color: "var(--color-secondary)" }}>
        {t("subtitle")}
      </p>
    </header>
  );
}
