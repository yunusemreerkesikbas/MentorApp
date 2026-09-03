import { DataCard } from "./data-card.js";
import { DigitPopIn } from "./transitions/digit-pop-in.js";

/** Web `public/img` asset — CountdownCard is panel-only. */
const HOURGLASS_SRC = "/img/hourglass.svg";

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
  /** Pre-localized labels (i18n lives in the app; ui is presentational). */
  labels: {
    remaining: string;
    dayUnit: string;
    today: string;
  };
  className?: string;
}

/**
 * Theme-ink hourglass — no well. Masked so `--color-main` flips with light/dark
 * (DESIGN.md §2/§7; calm countdown, no alarm-red).
 */
function HourglassGlyph() {
  return (
    <span
      aria-hidden
      className="block h-10 w-10 shrink-0"
      style={{
        backgroundColor: "var(--color-main)",
        maskImage: `url(${HOURGLASS_SRC})`,
        WebkitMaskImage: `url(${HOURGLASS_SRC})`,
        maskSize: "contain",
        WebkitMaskSize: "contain",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskPosition: "center",
      }}
    />
  );
}

/**
 * Calm countdown (product-specific, designed in the Nuton language; not a template node).
 * The exam date is authoritative content (AGENTS §4 #1) → rendered as a `DataCard`.
 * Framing is deliberately calm: muted hero number, soft blue accent, no red.
 */
export function CountdownCard({
  daysRemaining,
  examName,
  examDateLabel,
  labels,
  className,
}: CountdownCardProps) {
  const isToday = daysRemaining <= 0;
  const caption = examDateLabel ? `${examName} · ${examDateLabel}` : examName;

  return (
    <DataCard
      className={className}
      icon={<HourglassGlyph />}
      label={labels.remaining}
      value={
        isToday ? (
          labels.today
        ) : (
          <span>
            <DigitPopIn value={daysRemaining} />{" "}
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
    />
  );
}
