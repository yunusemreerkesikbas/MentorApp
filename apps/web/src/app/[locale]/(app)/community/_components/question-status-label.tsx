import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import type { QuestionStatus } from "./question-status";

/** Status as words, no chip: only "Çözüldü" carries a colour (canvas revision, 2026-10-07). */
export function QuestionStatusLabel({ status }: { status: QuestionStatus }) {
  const t = useTranslations("community");
  if (status.kind === "solved") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 text-caption font-extrabold text-[var(--color-success)]">
        <Check size={15} strokeWidth={2.5} aria-hidden />
        {t("status_solved")}
      </span>
    );
  }
  return (
    <span className="shrink-0 text-caption font-bold text-[var(--color-secondary)]">
      {status.kind === "answered"
        ? t("status_answers", { count: status.answers })
        : t("status_waiting")}
    </span>
  );
}
