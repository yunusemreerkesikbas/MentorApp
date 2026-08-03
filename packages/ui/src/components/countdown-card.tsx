import { Calendar } from "lucide-react";
import { DataCard } from "./data-card.js";

export interface CountdownCardProps {
  /**
   * Days remaining until the exam — computed server-side from the verified content
   * calendar (never recomputed on the client, never alarm-framed). DESIGN.md §9.
   */
  daysRemaining: number;
  /** Exam display name, e.g. "KPSS Lisans 2026". */
  examName: string;
  /** Authoritative exam date, pre-formatted for display by the server. */
  examDateLabel?: string;
  /** Verified source attribution (guardrail #1), e.g. { label: "ÖSYM", url }. */
  source?: { label: string; url?: string };
  /** Pre-localized labels (i18n lives in the app; ui is presentational). */
  labels: {
    remaining: string;
    dayUnit: string;
    today: string;
    sourcePrefix: string;
  };
  className?: string;
}

/** Calm calendar glyph in a soft tinted disc — no alarm-red (DESIGN.md §7/§9). */
function CalendarGlyph() {
  return (
    <span
      aria-hidden
      className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-card)]"
      style={{
        backgroundColor:
          "color-mix(in srgb, var(--color-progress) 18%, transparent)",
      }}
    >
      <Calendar size={24} color="var(--color-progress)" strokeWidth={2} />
    </span>
  );
}

/**
 * Calm countdown (product-specific, designed in the Nuton language; not a template node).
 * The exam date is authoritative content (AGENTS §4 #1) → rendered as a `DataCard` with a
 * verified source. Framing is deliberately calm: muted hero number, soft blue accent, no red.
 */
export function CountdownCard({
  daysRemaining,
  examName,
  examDateLabel,
  source,
  labels,
  className,
}: CountdownCardProps) {
  const isToday = daysRemaining <= 0;
  const caption = examDateLabel ? `${examName} · ${examDateLabel}` : examName;

  return (
    <DataCard
      className={className}
      icon={<CalendarGlyph />}
      label={labels.remaining}
      value={
        isToday ? (
          labels.today
        ) : (
          <span>
            {daysRemaining}{" "}
            <span
              className="text-base font-bold"
              style={{ color: "var(--color-secondary)" }}
            >
              {labels.dayUnit}
            </span>
          </span>
        )
      }
      caption={caption}
      source={source ? { ...source, prefix: labels.sourcePrefix } : undefined}
    />
  );
}
