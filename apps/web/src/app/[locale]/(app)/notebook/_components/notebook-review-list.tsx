"use client";

import Image from "next/image";
import { Check, FileText } from "lucide-react";
import { useTranslations } from "next-intl";
import type { NotebookEntryDto } from "@mentor/types";
import { REVIEW_CARD_WIDTH } from "./notebook-review-card";

/**
 * The deck as a list, grouped by subject — a way to see what today's review is made of and jump
 * into it, and nothing else.
 *
 * Deliberately not a checklist. The card exists because a list invites skimming and ticking, and
 * ticking a question you never looked at is the one thing this whole feature cannot survive. So
 * there is no answer control on any row: tapping a row takes you to that card, where the question
 * is, and the answer is given there. What the list is genuinely good at is orientation — "seven
 * cards, four of them Matematik" — which a one-card-at-a-time deck can never show.
 *
 * Cards already answered in this session are shown with a check and are not tappable. Without that
 * the list would be a way to answer the same card twice, which resets its interval ladder and
 * quietly undoes the student's own progress.
 */

export interface NotebookReviewListProps {
  /** The deck as it was when the panel opened — same order the cards are shown in. */
  entries: NotebookEntryDto[];
  currentIndex: number;
  answered: ReadonlySet<string>;
  onPick: (index: number) => void;
}

interface Row {
  entry: NotebookEntryDto;
  index: number;
}

export function NotebookReviewList({
  entries,
  currentIndex,
  answered,
  onPick,
}: NotebookReviewListProps) {
  const t = useTranslations("notebook");

  // Derived during render, not held in state: the deck never changes while the panel is open, and a
  // memo of a seven-item group-by would cost more to read than it saves.
  const groups: Array<{ subject: string; rows: Row[] }> = [];
  entries.forEach((entry, index) => {
    const subject = entry.subjectName ?? t("review_list_ungrouped");
    const group = groups.find((candidate) => candidate.subject === subject);
    if (group) group.rows.push({ entry, index });
    else groups.push({ subject, rows: [{ entry, index }] });
  });

  return (
    <div
      // ponytail: no fade mask at the edges. It only earns its keep on a list long enough to
      // scroll, and a plain `mask-image` cannot tell — on a three-card deck it just dimmed the
      // first heading and the last row for no reason.
      className={`flex max-h-[70vh] ${REVIEW_CARD_WIDTH} flex-col overflow-y-auto rounded-[var(--radius-card)] p-2`}
      style={{
        backgroundColor: "var(--color-bg)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      {groups.map((group) => (
        <div key={group.subject} className="flex flex-col">
          <span
            className="px-2 pb-1 pt-3 text-xs font-bold"
            style={{ color: "var(--color-secondary)" }}
          >
            {group.subject}
          </span>
          {group.rows.map(({ entry, index }) => (
            <ListRow
              key={entry.id}
              entry={entry}
              current={index === currentIndex}
              done={answered.has(entry.id)}
              onPick={() => onPick(index)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function ListRow({
  entry,
  current,
  done,
  onPick,
}: {
  entry: NotebookEntryDto;
  current: boolean;
  done: boolean;
  onPick: () => void;
}) {
  const t = useTranslations("notebook");
  const label = entry.topicName ?? t("card_unlabelled");

  return (
    <button
      type="button"
      disabled={done}
      aria-current={current ? "true" : undefined}
      onClick={onPick}
      className="flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-[var(--radius-card)] px-2 text-left outline-none transition-colors duration-150 hover:bg-[var(--color-surface-container)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:cursor-default disabled:opacity-45 disabled:hover:bg-transparent motion-reduce:transition-none"
      style={
        current
          ? { backgroundColor: "var(--color-accent-soft)" }
          : undefined
      }
    >
      <span
        className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-card)]"
        style={{ backgroundColor: "var(--color-surface-container)" }}
      >
        {entry.url ? (
          <Image
            src={entry.url}
            alt=""
            fill
            sizes="40px"
            className="object-cover"
          />
        ) : (
          // A text-only entry, not a broken image — `ImageOff`'s struck-through icon read as an
          // error on every row of a deck where having no photo is perfectly normal.
          <FileText
            aria-hidden
            size={16}
            style={{ color: "var(--color-secondary)" }}
          />
        )}
      </span>

      <span className="flex min-w-0 flex-1 flex-col">
        <span
          className="truncate text-sm font-semibold"
          style={{ color: "var(--color-main)" }}
        >
          {label}
        </span>
        <span
          className="truncate text-xs"
          style={{ color: "var(--color-secondary)" }}
        >
          {t(`error_type.${entry.errorType}`)}
        </span>
      </span>

      {done ? (
        <Check
          aria-label={t("review_list_done")}
          size={16}
          style={{ color: "var(--color-success)" }}
        />
      ) : null}
    </button>
  );
}
