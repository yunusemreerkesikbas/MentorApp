"use client";

import { FORUM_REACTION_EMOJIS } from "@mentor/types";

export function ReactionBar({
  counts,
  mine,
  onToggle,
}: {
  counts: Record<string, number>;
  mine: string[];
  onToggle: (emoji: string, adding: boolean) => void;
}) {
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {FORUM_REACTION_EMOJIS.map((emoji) => {
        const count = counts[emoji] ?? 0;
        const reacted = mine.includes(emoji);
        return (
          <button
            key={emoji}
            type="button"
            aria-pressed={reacted}
            onClick={() => onToggle(emoji, !reacted)}
            className="inline-flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] active:scale-95 motion-reduce:transition-none"
            style={{
              background: reacted
                ? "color-mix(in srgb, var(--color-chip) 28%, white)"
                : "rgba(0,0,0,0.05)",
              border: reacted
                ? "1px solid color-mix(in srgb, var(--color-chip) 60%, transparent)"
                : "1px solid transparent",
              color: reacted ? "var(--color-chip-text)" : "var(--color-secondary)",
            }}
          >
            <span aria-hidden className="text-sm leading-none">{emoji}</span>
            {count > 0 && (
              <span style={{ color: reacted ? "var(--color-chip-text)" : "var(--color-secondary)" }}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
