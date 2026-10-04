"use client";

import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { PlanWeekNavButton } from "./plan-week-nav-button";

export function CoachPlanToolbar() {
  const t = useTranslations("coachPlan");
  const router = useRouter();

  return (
    <header className="flex shrink-0 items-center gap-2">
      <h1 className="sr-only">{t("title")}</h1>
      <PlanWeekNavButton label={t("back")} onClick={() => router.push("/students")}>
        <ArrowLeft size={20} strokeWidth={2} aria-hidden />
      </PlanWeekNavButton>
    </header>
  );
}
