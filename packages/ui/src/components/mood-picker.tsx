"use client";

/** 1..5 mood scale (AGENTS §4 #5 — integer only, never free text). */
export const MOOD_OPTIONS = [
  { value: 1, emoji: "😞", label: "Çok zor" },
  { value: 2, emoji: "😕", label: "Zor" },
  { value: 3, emoji: "😐", label: "İdare eder" },
  { value: 4, emoji: "🙂", label: "İyi" },
  { value: 5, emoji: "😄", label: "Harika" },
] as const;

export interface MoodPickerProps {
  /** Selected mood (1..5) or null when not yet chosen — controlled by the parent. */
  value: number | null;
  /** Selection handler. The encouraging response is rule-based and comes from the backend. */
  onChange?: (mood: number) => void;
  /** Accessible group label. */
  ariaLabel?: string;
  className?: string;
}

/**
 * Mood picker — 5-emoji rule-based scale (plan Slice 5; AGENTS §4 #5).
 * Pure UI: emits a 1..5 integer; no AI, no free-text, no client-side scoring.
 * Rendered as a radiogroup for keyboard + screen-reader support.
 */
export function MoodPicker({
  value,
  onChange,
  ariaLabel = "Bugün nasılsın?",
  className,
}: MoodPickerProps) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`flex items-center justify-between gap-2 ${className ?? ""}`}
    >
      {MOOD_OPTIONS.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={option.label}
            title={option.label}
            onClick={() => onChange?.(option.value)}
            className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-card)] text-2xl transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none motion-reduce:hover:scale-100"
            style={{
              backgroundColor: selected
                ? "color-mix(in srgb, var(--color-chip) 30%, transparent)"
                : "transparent",
              transform: selected ? "scale(1.1)" : undefined,
              boxShadow: selected ? "var(--shadow-card)" : undefined,
            }}
          >
            <span aria-hidden>{option.emoji}</span>
          </button>
        );
      })}
    </div>
  );
}
