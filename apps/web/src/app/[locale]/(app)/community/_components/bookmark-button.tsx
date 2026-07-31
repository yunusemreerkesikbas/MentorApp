"use client";

import { useTranslations } from "next-intl";
import { BookmarkIcon } from "./forum-icons";

/**
 * Save/unsave toggle. Optimistic — the parent owns `bookmarked` state and reconciles the API call
 * (mirrors the like button). Stops propagation so it never triggers a clickable row's navigation.
 */
export function BookmarkButton({
  bookmarked,
  onToggle,
}: {
  bookmarked: boolean;
  onToggle: (adding: boolean) => void;
}) {
  const t = useTranslations("community");
  return (
    <button
      type="button"
      aria-pressed={bookmarked}
      aria-label={t("bookmark")}
      onClick={(e) => {
        e.stopPropagation();
        onToggle(!bookmarked);
      }}
      className="group/bm flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-black/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
      style={{ color: bookmarked ? "var(--color-chip-text)" : "var(--color-main)" }}
    >
      <span
        key={bookmarked ? "on" : "off"}
        className="inline-flex transition-transform duration-150 group-active/bm:scale-90 motion-reduce:transition-none"
      >
        <BookmarkIcon filled={bookmarked} />
      </span>
    </button>
  );
}
