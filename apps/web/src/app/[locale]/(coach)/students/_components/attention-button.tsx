"use client";

import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { Button } from "@mentor/ui";
import { relativeDay } from "../../_components/mentorship-format";

/**
 * "İlgilendim" — the coach's mark on one student.
 *
 * It records that the coach looked and acted; it does not claim the problem is solved. The flags
 * stay on the card either way, because the numbers are the student's and the mark is the coach's.
 *
 * Rendered OUTSIDE the card's `<Link>` by every caller: a button inside an anchor is invalid HTML.
 *
 * The readback lives in {@link AttentionStatus} rather than here, because the row's bottom band
 * has one text slot and two things want it — the suggestion before the mark, the readback after.
 * They are alternatives, so the card picks; a button that carried its own line would force both.
 */
export function AttentionButton({
  attendedAt,
  busy,
  onToggle,
  fullWidth,
}: {
  attendedAt: string | null;
  busy: boolean;
  onToggle: (attended: boolean) => void;
  /** Full width on a phone: it is the row's only action and a thumb misses an inline button. */
  fullWidth?: boolean;
}) {
  const t = useTranslations("mentorship");
  const marked = attendedAt !== null;

  return (
    <Button
      type="button"
      variant={marked ? "ghost" : "secondary"}
      fullWidth={fullWidth}
      // `disabled`, not `busy`: the update is optimistic, so the row already shows the new state
      // and a spinner would contradict it.
      disabled={busy}
      onClick={() => onToggle(!marked)}
    >
      {!marked && <Check aria-hidden size={15} strokeWidth={2.25} />}
      {marked ? t("attention_undo") : t("attention_mark")}
    </Button>
  );
}

/** When the coach last marked this student, in words. Null before the first mark. */
export function AttentionStatus({ attendedAt }: { attendedAt: string }) {
  const t = useTranslations("mentorship");
  const when = relativeDay(attendedAt.slice(0, 10));

  return (
    <p className="m-0 text-sm" style={{ color: "var(--color-secondary)" }}>
      {when.kind === "today"
        ? t("attention_marked_today")
        : when.kind === "yesterday"
          ? t("attention_marked_yesterday")
          : t("attention_marked_days_ago", {
              count: when.kind === "daysAgo" ? when.days : 0,
            })}
    </p>
  );
}
