"use client";

import { useTranslations } from "next-intl";

import { HelpfulVoteIcon } from "./forum-icons";
import { getHelpfulActionPresentation } from "./helpful-action";

export function HelpfulButton({
  count,
  selected,
  disabled = false,
  canVote = true,
  onToggle,
}: {
  count: number;
  selected: boolean;
  disabled?: boolean;
  canVote?: boolean;
  onToggle: (selected: boolean) => void;
}) {
  const t = useTranslations("community");
  const presentation = getHelpfulActionPresentation({
    count,
    accessibleLabel: t("helpful"),
    unavailableLabel: t("helpful_self_unavailable"),
    canVote,
  });

  return (
    <button
      type="button"
      aria-label={presentation.ariaLabel}
      aria-pressed={selected}
      aria-disabled={!canVote}
      disabled={disabled}
      title={!canVote ? t("helpful_self_unavailable") : undefined}
      onClick={() => {
        if (canVote) onToggle(!selected);
      }}
      className={`community-post-action flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-full px-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-50 ${!canVote ? "cursor-default opacity-60" : selected ? "bg-[var(--community-green-soft)] text-[var(--community-green)]" : "text-[var(--color-main)] hover:bg-[var(--color-soft)]"}`}
    >
      <HelpfulVoteIcon filled={selected} />
      <span className="text-[13px] tabular-nums">{presentation.visibleCount}</span>
    </button>
  );
}
