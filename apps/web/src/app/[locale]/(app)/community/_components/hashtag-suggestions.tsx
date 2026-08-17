"use client";

import { Hash } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ForumTagView } from "@mentor/types";

export function HashtagSuggestions({
  id,
  query,
  suggestions,
  activeIndex,
  onActiveIndexChange,
  onSelect,
}: {
  id: string;
  query: string;
  suggestions: ForumTagView[];
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  onSelect: (tag: ForumTagView) => void;
}) {
  const t = useTranslations("community");

  return (
    <div
      id={id}
      role="listbox"
      aria-label={t("hashtag_suggestions")}
      className="absolute left-0 top-full z-20 mt-1 w-full max-w-sm overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] py-1 shadow-[var(--shadow-card)]"
    >
      {suggestions.length > 0 ? (
        suggestions.map((tag, index) => (
          <button
            key={tag.id}
            id={`${id}-${index}`}
            type="button"
            role="option"
            aria-selected={index === activeIndex}
            onMouseDown={(event) => {
              event.preventDefault();
              onSelect(tag);
            }}
            onMouseEnter={() => onActiveIndexChange(index)}
            className={`flex min-h-11 w-full items-center gap-2.5 px-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-focus-ring)] ${index === activeIndex ? "bg-[var(--color-soft)]" : "bg-transparent"}`}
          >
            <Hash size={16} className="shrink-0 text-[var(--community-blue-ink)]" aria-hidden />
            <span className="min-w-0 truncate text-sm font-bold text-[var(--color-main)]">#{tag.slug}</span>
          </button>
        ))
      ) : (
        <p className="px-3 py-3 text-sm font-normal text-[var(--color-secondary)]">
          {t("hashtag_custom_hint", { tag: query })}
        </p>
      )}
    </div>
  );
}
