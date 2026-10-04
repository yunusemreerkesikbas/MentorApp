"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import type { NotebookEntryDto } from "@mentor/types";

/**
 * One mistake, as it sits on the page.
 *
 * A photographed mistake shows just the photo — the wall is meant to be looked at, and a card
 * crowded with a chip, a topic name and a note on top of a thumbnail reads as a form, not a page.
 * The details move into a hover/focus card instead of disappearing: still one interaction away,
 * never permanently hidden. A text-only mistake (no photo) has nothing to hide behind, so it keeps
 * the full layout inline.
 *
 * A healed card stays on the page and goes quiet instead of disappearing — the wall is a healing
 * map, and a page that empties as you improve takes the evidence of improvement with it.
 */

/** Everything is a share of the card's own width, so one card renders at any page size. */
export interface NotebookEntryCardProps {
  entry: NotebookEntryDto;
  /** True when this card's review moment has arrived; the page lifts it out of the crowd. */
  due?: boolean;
  /** True while the item is selected on the page; a photo card drops its resting tilt. */
  selected?: boolean;
  /** Photo cards only — opens the full-size preview. */
  onPreview?: (entry: NotebookEntryDto) => void;
}

function DetailLines({ entry, healed }: { entry: NotebookEntryDto; healed: boolean }) {
  const t = useTranslations("notebook");
  return (
    <>
      <span
        style={{
          alignSelf: "flex-start",
          padding: "1.2cqw 3cqw",
          borderRadius: 999,
          fontSize: "3.4cqw",
          fontWeight: 600,
          color: "var(--color-chip-text)",
          backgroundColor: "color-mix(in srgb, var(--color-chip) 30%, white)",
        }}
      >
        {t(`error_type.${entry.errorType}`)}
      </span>

      <span
        className="truncate"
        style={{ fontSize: "4cqw", fontWeight: 700, color: "var(--color-main)" }}
      >
        {entry.topicName ?? entry.subjectName ?? t("card_unlabelled")}
      </span>

      {entry.note ? (
        <span
          className="line-clamp-2"
          style={{ fontSize: "3.2cqw", color: "var(--color-secondary)" }}
        >
          {entry.note}
        </span>
      ) : null}

      <span
        style={{
          marginTop: "auto",
          fontSize: "3cqw",
          // An answer waiting outranks the review count: it is the only line here the user can
          // act on right now, and a healed card that got there via the community still earned it.
          color: entry.communityAnsweredAt
            ? "var(--color-accent)"
            : healed
              ? "var(--color-success)"
              : "var(--color-secondary)",
          fontWeight: entry.communityAnsweredAt ? 600 : 400,
        }}
      >
        {entry.communityAnsweredAt
          ? t("card_community_answered")
          : healed
            ? t("card_healed")
            : t("card_review_count", { count: entry.reviewCount })}
      </span>
    </>
  );
}

/**
 * A small, stable tilt per entry (about ±1.5°), so a page of prints looks placed by hand without
 * a card jumping to a new angle on every render.
 */
function restingTilt(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return ((Math.abs(hash) % 31) - 15) / 10;
}

export function NotebookEntryCard({ entry, due, selected, onPreview }: NotebookEntryCardProps) {
  const t = useTranslations("notebook");
  const healed = entry.status === "HEALED";
  const borderStyle = {
    // The due ring is the only loud thing on the page, and only while it is earned.
    border: due
      ? "2px solid var(--color-progress)"
      : "1px solid color-mix(in srgb, var(--color-main) 10%, transparent)",
    boxShadow: "var(--shadow-card)",
  };

  if (entry.url) {
    const caption = entry.topicName ?? entry.subjectName;
    return (
      <div
        className="group relative h-full w-full transition-transform duration-200 ease-out motion-reduce:transition-none"
        style={{
          containerType: "inline-size",
          // The resting tilt is what makes it read as stuck on by hand. It straightens while the
          // item is selected so the print lines up with the selection frame and its handles.
          transform: selected ? undefined : `rotate(${restingTilt(entry.id)}deg)`,
          opacity: healed ? 0.55 : 1,
        }}
      >
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onPreview?.(entry);
          }}
          aria-label={t("card_preview_aria", { type: t(`error_type.${entry.errorType}`) })}
          className="flex h-full w-full cursor-pointer flex-col gap-[1.6cqw] rounded-[0.8cqw] p-[3cqw] text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          style={{
            backgroundColor: "var(--notebook-print)",
            boxShadow: "var(--notebook-print-shadow)",
            // The due ring is the only loud thing on the page, and only while it is earned.
            outline: due ? "2px solid var(--color-progress)" : undefined,
            outlineOffset: due ? "-2px" : undefined,
          }}
        >
          {caption ? (
            // Centred and inset past the tape so neither strip lands on the words.
            <span
              className="block truncate text-center"
              style={{
                paddingInline: "11cqw",
                fontSize: "max(10px, 2.6cqw)",
                fontWeight: 800,
                lineHeight: 1.2,
                color: "var(--notebook-print-caption)",
              }}
            >
              {caption}
            </span>
          ) : null}

          {/*
            `object-contain`, not `cover`: the placed box's aspect ratio is whatever the user drags
            it to, almost never the photo's own — and this photo IS the question, unlike a vision
            board photo where a tight crop is a look. Cropping into an equation or an answer choice
            makes the card useless for the one thing it exists to be reviewed for. The print's own
            white is what the letterboxed edges fall onto, so they read as margin, not a gap.
          */}
          <span className="relative block min-h-0 w-full flex-1 overflow-hidden">
            <Image src={entry.url} alt="" fill sizes="480px" className="object-contain" unoptimized />

            {/*
              Details only on hover/focus, as a small paper slip in the photo's corner: the photo
              stays readable underneath, unlike the dark gradient band this replaced, which hid the
              bottom third of the question. The topic is not repeated here; it is on the print's
              top margin already.
            */}
            <span
              aria-hidden
              className="pointer-events-none absolute flex translate-y-[1cqw] flex-col opacity-0 transition duration-150 ease-out group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100 motion-reduce:transition-none"
              style={{
                left: "2cqw",
                bottom: "2cqw",
                maxWidth: "min(72%, 300px)",
                gap: "0.4em",
                padding: "0.6em 0.85em",
                borderRadius: "0.5em",
                fontSize: "clamp(11px, 2.1cqw, 14px)",
                lineHeight: 1.25,
                color: "var(--notebook-ink)",
                backgroundColor: "var(--notebook-print)",
                boxShadow: "var(--notebook-slip-shadow)",
              }}
            >
              <span className="truncate" style={{ fontWeight: 800 }}>
                {t(`error_type.${entry.errorType}`)}
              </span>
              {entry.note ? (
                <span className="line-clamp-2" style={{ color: "var(--notebook-print-caption)" }}>
                  {entry.note}
                </span>
              ) : null}
              <span
                style={{
                  fontWeight: 700,
                  // An answer waiting outranks the review count, same as the text-only card.
                  color: entry.communityAnsweredAt
                    ? "var(--notebook-answered-ink)"
                    : healed
                      ? "var(--notebook-healed-ink)"
                      : "var(--notebook-print-caption)",
                }}
              >
                {entry.communityAnsweredAt
                  ? t("card_community_answered")
                  : healed
                    ? t("card_healed")
                    : entry.reviewCount > 0
                      ? t("card_review_count", { count: entry.reviewCount })
                      : t("card_review_none")}
              </span>
            </span>
          </span>
        </button>

        {/* Two strips of masking tape over the top corners, angled the way a hand tears them. */}
        <span
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            left: "-3.6cqw",
            top: "-2.4cqw",
            width: "17cqw",
            height: "5.6cqw",
            backgroundColor: "var(--notebook-tape)",
            transform: "rotate(-32deg)",
          }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            right: "-3.6cqw",
            top: "-2cqw",
            width: "17cqw",
            height: "5.6cqw",
            backgroundColor: "var(--notebook-tape)",
            transform: "rotate(30deg)",
          }}
        />
      </div>
    );
  }

  return (
    <div
      aria-label={t("card_aria", { type: t(`error_type.${entry.errorType}`) })}
      style={{
        containerType: "inline-size",
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        gap: "2cqw",
        padding: "4cqw",
        borderRadius: "var(--radius-card)",
        backgroundColor: "var(--color-surface)",
        ...borderStyle,
        opacity: healed ? 0.55 : 1,
        transition: "opacity 200ms ease-out, box-shadow 200ms ease-out",
      }}
      className="motion-reduce:transition-none"
    >
      <DetailLines entry={entry} healed={healed} />
    </div>
  );
}
