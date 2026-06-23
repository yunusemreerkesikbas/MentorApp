"use client";

import { useTranslations } from "next-intl";
import type { ThreadView } from "@mentor/types";
import { Card, Chip } from "@mentor/ui";
import { Link } from "@/i18n/navigation";

/** A question row in a QA zone — links to the question detail. */
export function QuestionListItem({ question }: { question: ThreadView }) {
  const t = useTranslations("topluluk");
  return (
    <Link
      href={`/topluluk/soru/${question.id}`}
      className="block rounded-[var(--radius-card)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
    >
      <Card>
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-semibold" style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}>
            {question.title ?? question.body.slice(0, 80)}
          </h3>
          {question.status === "ANSWERED" ? <Chip>{t("answered")}</Chip> : null}
        </div>
        <p className="mt-2 line-clamp-2 text-sm" style={{ color: "var(--color-secondary)" }}>
          {question.body}
        </p>
      </Card>
    </Link>
  );
}
