"use client";

import { useTranslations } from "next-intl";
import { AuthorAvatar } from "./author-avatar";
import type { MentionAutocomplete } from "./use-mention-autocomplete";

/**
 * @mention suggestion listbox (APP-021). Renders directly below the composer textarea
 * (ponytail: no caret-anchored popup) inside a relatively-positioned wrapper. Selection via
 * mouse or the hook's ↑↓/Enter/Tab handling; `aria-activedescendant` lives on the textarea.
 */
export function MentionSuggestions({ mention }: { mention: MentionAutocomplete }) {
  const t = useTranslations("community");
  if (!mention.open) return null;
  return (
    <ul
      id={mention.listboxId}
      role="listbox"
      aria-label={t("mention_suggestions_label")}
      className="absolute left-0 top-full z-20 mt-1 w-full max-w-sm overflow-hidden rounded-[var(--radius-card)] bg-[var(--color-surface)] py-1 shadow-lg"
      style={{ border: "1px solid rgba(0,0,0,0.08)" }}
    >
      {mention.suggestions.map((s, i) => (
        <li
          key={s.username}
          id={`${mention.listboxId}-${i}`}
          role="option"
          aria-selected={i === mention.activeIndex}
          // mousedown (not click) so the textarea never loses focus/caret before we replace.
          onMouseDown={(e) => {
            e.preventDefault();
            mention.select(s);
          }}
          onMouseEnter={() => mention.setActiveIndex(i)}
          className="flex cursor-pointer items-center gap-2.5 px-3 py-2"
          style={{ background: i === mention.activeIndex ? "rgba(0,0,0,0.05)" : "transparent" }}
        >
          <AuthorAvatar name={s.displayName} size={28} src={s.avatarUrl} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-medium" style={{ color: "var(--color-main)" }}>
              {s.displayName}
            </span>
            <span className="block truncate text-[12px]" style={{ color: "var(--color-secondary)" }}>
              @{s.username}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
