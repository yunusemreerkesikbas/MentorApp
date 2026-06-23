"use client";

import { FORUM_REACTION_EMOJIS } from "@mentor/types";

/** Fixed emoji reaction row; the viewer's own reactions are highlighted. Toggle is optimistic. */
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
    <div className="mt-3 flex flex-wrap gap-2">
      {FORUM_REACTION_EMOJIS.map((emoji) => {
        const count = counts[emoji] ?? 0;
        const reacted = mine.includes(emoji);
        return (
          <button
            key={emoji}
            type="button"
            aria-pressed={reacted}
            onClick={() => onToggle(emoji, !reacted)}
            className="inline-flex min-h-[32px] items-center gap-1 rounded-[var(--radius-card)] border px-2 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
            style={{
              borderColor: reacted
                ? "color-mix(in srgb, var(--color-main) 30%, transparent)"
                : "color-mix(in srgb, var(--color-main) 10%, transparent)",
              backgroundColor: reacted
                ? "color-mix(in srgb, var(--color-chip) 30%, transparent)"
                : "transparent",
            }}
          >
            <span aria-hidden>{emoji}</span>
            {count > 0 ? (
              <span style={{ color: "var(--color-secondary)" }}>{count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
