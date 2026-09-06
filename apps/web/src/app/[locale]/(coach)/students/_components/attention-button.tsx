"use client";

import { useTranslations } from "next-intl";
import { Button } from "@mentor/ui";
import { relativeDay } from "../../_components/mentorship-format";

/**
 * "İlgilendim" — the coach's mark on one student, and the line that reads it back.
 *
 * It records that the coach looked and acted; it does not claim the problem is solved. The flags
 * stay on the card either way, because the numbers are the student's and the mark is the coach's.
 *
 * Rendered OUTSIDE the card's `<Link>` by every caller: a button inside an anchor is invalid HTML,
 * the same trap the card's suggestion line already avoids.
 */
export function AttentionButton({
  attendedAt,
  busy,
  onToggle,
}: {
  attendedAt: string | null;
  busy: boolean;
  onToggle: (attended: boolean) => void;
}) {
  const t = useTranslations("mentorship");
  const marked = attendedAt !== null;
  const when = relativeDay(marked ? attendedAt.slice(0, 10) : null);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs" style={{ color: "var(--color-secondary)" }}>
        {!marked
          ? t("attention_hint")
          : when.kind === "today"
            ? t("attention_marked_today")
            : when.kind === "yesterday"
              ? t("attention_marked_yesterday")
              : t("attention_marked_days_ago", {
                  count: when.kind === "daysAgo" ? when.days : 0,
                })}
      </p>
      <Button
        type="button"
        variant={marked ? "ghost" : "secondary"}
        disabled={busy}
        onClick={() => onToggle(!marked)}
      >
        {marked ? t("attention_undo") : t("attention_mark")}
      </Button>
    </div>
  );
}
