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

export function NotebookEntryCard({ entry, due, onPreview }: NotebookEntryCardProps) {
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
    return (
      <div
        className="group relative h-full w-full"
        style={{ containerType: "inline-size" }}
      >
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onPreview?.(entry);
          }}
          aria-label={t("card_preview_aria", { type: t(`error_type.${entry.errorType}`) })}
          className="block h-full w-full cursor-pointer overflow-hidden rounded-[var(--radius-card)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          style={{ ...borderStyle, opacity: healed ? 0.55 : 1 }}
        >
          <span
            className="relative block h-full w-full"
            style={{ backgroundColor: "var(--color-surface-container)" }}
          >
            <Image src={entry.url} alt="" fill sizes="480px" className="object-cover" unoptimized />
          </span>
        </button>

        {/* Details only on hover/focus — the photo itself stays clean. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-[1.4cqw] rounded-b-[var(--radius-card)] p-[3.4cqw] opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 motion-reduce:transition-none"
          style={{ background: "linear-gradient(to top, rgba(17,17,17,0.78), transparent)" }}
        >
          <span
            style={{
              alignSelf: "flex-start",
              padding: "1cqw 2.8cqw",
              borderRadius: 999,
              fontSize: "3cqw",
              fontWeight: 600,
              color: "#ffffff",
              backgroundColor: "rgba(255,255,255,0.2)",
            }}
          >
            {t(`error_type.${entry.errorType}`)}
          </span>
          <span
            className="truncate"
            style={{ fontSize: "3.4cqw", fontWeight: 700, color: "#ffffff" }}
          >
            {entry.topicName ?? entry.subjectName ?? t("card_unlabelled")}
          </span>
          {entry.note ? (
            <span
              className="line-clamp-2"
              style={{ fontSize: "2.8cqw", color: "rgba(255,255,255,0.85)" }}
            >
              {entry.note}
            </span>
          ) : null}
          <span
            style={{
              fontSize: "2.8cqw",
              color: entry.communityAnsweredAt
                ? "#93c5fd"
                : healed
                  ? "#86efac"
                  : "rgba(255,255,255,0.85)",
            }}
          >
            {entry.communityAnsweredAt
              ? t("card_community_answered")
              : healed
                ? t("card_healed")
                : t("card_review_count", { count: entry.reviewCount })}
          </span>
        </div>
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
