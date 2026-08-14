"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import type { NotebookEntryDto } from "@mentor/types";

/**
 * One mistake, as it sits on the page.
 *
 * The card leads with the error type, not the subject. The subject is what the student already
 * knows; "you keep making careless slips here" is the sentence they cannot write themselves, and
 * putting it first is what stops the wall from reading as a list of failures.
 *
 * A healed card stays on the page and goes quiet instead of disappearing — the wall is a healing
 * map, and a page that empties as you improve takes the evidence of improvement with it.
 */

/** Everything is a share of the card's own width, so one card renders at any page size. */
export interface NotebookEntryCardProps {
  entry: NotebookEntryDto;
  /** True when this card's review moment has arrived; the page lifts it out of the crowd. */
  due?: boolean;
  onOpen?: (entry: NotebookEntryDto) => void;
}

export function NotebookEntryCard({ entry, due, onOpen }: NotebookEntryCardProps) {
  const t = useTranslations("notebook");
  const healed = entry.status === "HEALED";

  return (
    <button
      type="button"
      onClick={() => onOpen?.(entry)}
      aria-label={t("card_aria", { type: t(`error_type.${entry.errorType}`) })}
      style={{
        containerType: "inline-size",
        display: "flex",
        width: "100%",
        height: "100%",
        gap: "4cqw",
        padding: "4cqw",
        textAlign: "left",
        cursor: "pointer",
        borderRadius: "var(--radius-card)",
        backgroundColor: "var(--color-surface)",
        // The due ring is the only loud thing on the page, and only while it is earned.
        border: due
          ? "2px solid var(--color-progress)"
          : "1px solid color-mix(in srgb, var(--color-main) 10%, transparent)",
        boxShadow: "var(--shadow-card)",
        opacity: healed ? 0.55 : 1,
        transition: "opacity 200ms ease-out, box-shadow 200ms ease-out",
      }}
      className="motion-reduce:transition-none"
    >
      {entry.url ? (
        <span
          style={{
            position: "relative",
            flex: "0 0 32cqw",
            borderRadius: "calc(var(--radius-card) - 2px)",
            overflow: "hidden",
            backgroundColor: "var(--color-surface-container)",
          }}
        >
          <Image
            src={entry.url}
            alt=""
            fill
            sizes="240px"
            className="object-cover"
            unoptimized
          />
        </span>
      ) : null}

      <span className="flex min-w-0 flex-1 flex-col gap-[2cqw]">
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
            color: healed ? "var(--color-success)" : "var(--color-secondary)",
          }}
        >
          {healed
            ? t("card_healed")
            : t("card_review_count", { count: entry.reviewCount })}
        </span>
      </span>
    </button>
  );
}
