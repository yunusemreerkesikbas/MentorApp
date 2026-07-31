"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import SmilePlus from "lucide-react/dist/esm/icons/smile-plus.mjs";
import { FORUM_REACTION_EMOJIS } from "@mentor/types";

/**
 * Shared reaction control (threads + comments): a picker popover for the positive-emoji palette plus
 * inline count chips for the emojis this item already carries. A user may hold multiple reactions
 * (each toggles independently). Optimistic toggling is the parent's job via `onToggle`.
 */
export function ReactionBar({
  reactionCounts,
  myReactions,
  onToggle,
}: {
  reactionCounts: Record<string, number>;
  myReactions: string[];
  onToggle: (emoji: string, adding: boolean) => void;
}) {
  const t = useTranslations("community");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const active = new Set(myReactions);
  const chips = FORUM_REACTION_EMOJIS.filter((e) => (reactionCounts[e] ?? 0) > 0);

  const toggle = (emoji: string) => {
    onToggle(emoji, !active.has(emoji));
    setOpen(false);
  };

  // Own the clicks — never let a reaction interaction trigger the row's navigation.
  return (
    <div ref={ref} className="relative flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        aria-label={t("reaction_add")}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-black/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        style={{ color: "var(--color-main)" }}
      >
        <SmilePlus size={18} aria-hidden="true" />
      </button>

      {chips.map((emoji) => {
        const mine = active.has(emoji);
        return (
          <button
            key={emoji}
            type="button"
            aria-pressed={mine}
            aria-label={`${emoji} ${reactionCounts[emoji]}`}
            onClick={() => toggle(emoji)}
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[13px] tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            style={{
              background: mine
                ? "color-mix(in srgb, var(--color-chip) 22%, white)"
                : "rgba(0,0,0,0.04)",
              color: "var(--color-main)",
            }}
          >
            <span aria-hidden="true">{emoji}</span>
            {reactionCounts[emoji]}
          </button>
        );
      })}

      {open && (
        <div
          role="menu"
          className="absolute bottom-full left-0 z-20 mb-1 flex gap-1 rounded-full border bg-white p-1 shadow-[var(--shadow-card)]"
          style={{ borderColor: "rgba(0,0,0,0.08)" }}
        >
          {FORUM_REACTION_EMOJIS.map((emoji, i) => (
            <button
              key={emoji}
              type="button"
              role="menuitem"
              autoFocus={i === 0}
              aria-label={emoji}
              onClick={() => toggle(emoji)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-[18px] transition-colors hover:bg-[#f1f3f6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
              style={{
                background: active.has(emoji)
                  ? "color-mix(in srgb, var(--color-chip) 22%, white)"
                  : undefined,
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
