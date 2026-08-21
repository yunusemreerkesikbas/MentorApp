"use client";

import Image from "next/image";
import { Check, FileText, Undo2 } from "lucide-react";
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
  /**
   * The whole deck as it was when the panel opened, never the filtered view: the list is how a
   * student switches subjects, so it has to show the subject they are not currently studying.
   */
  entries: NotebookEntryDto[];
  /** By id, not position — the deck may be filtered, so an index means two different cards. */
  currentId: string | null;
  answered: ReadonlySet<string>;
  subjectFilter: string | null;
  onFilter: (subject: string | null) => void;
  onPick: (entryId: string) => void;
}

interface Group {
  /** Raw subject name, or null for the entries nobody has labelled yet. */
  subject: string | null;
  label: string;
  rows: NotebookEntryDto[];
}

export function NotebookReviewList({
  entries,
  currentId,
  answered,
  subjectFilter,
  onFilter,
  onPick,
}: NotebookReviewListProps) {
  const t = useTranslations("notebook");

  // Derived during render, not held in state: the deck never changes while the panel is open, and a
  // memo of a seven-item group-by would cost more to read than it saves.
  const groups: Group[] = [];
  entries.forEach((entry) => {
    const subject = entry.subjectName ?? null;
    const group = groups.find((candidate) => candidate.subject === subject);
    if (group) group.rows.push(entry);
    else {
      groups.push({
        subject,
        label: subject ?? t("review_list_ungrouped"),
        rows: [entry],
      });
    }
  });

  return (
    <div
      // ponytail: no fade mask at the edges. It only earns its keep on a list long enough to
      // scroll, and a plain `mask-image` cannot tell — on a three-card deck it just dimmed the
      // first heading and the last row for no reason.
      className={`flex max-h-[70vh] ${REVIEW_CARD_WIDTH} flex-col overflow-y-auto rounded-[var(--radius-card)] p-2`}
      style={{
        // Matches the card it replaces: on the dark theme `--color-bg` is a shade off the 85%-black
        // scrim, so the list had no edge at all and read as text floating on the backdrop.
        backgroundColor: "var(--color-surface)",
        border: "1px solid color-mix(in srgb, var(--color-main) 10%, transparent)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      {subjectFilter ? (
        // Only shown while a filter is on: the way back has to be in the same place the way in was.
        <button
          type="button"
          onClick={() => onFilter(null)}
          className="mb-1 flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-[var(--radius-card)] px-2 text-left text-sm font-semibold outline-none transition-colors duration-150 hover:bg-[var(--color-surface-container)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
          style={{ color: "var(--color-main)" }}
        >
          <Undo2 aria-hidden size={14} />
          {t("review_list_all_subjects")}
        </button>
      ) : null}

      {groups.map((group) => (
        <div key={group.label} className="flex flex-col">
          <div className="flex items-center justify-between gap-2 px-2 pb-1 pt-3">
            <span
              className="text-xs font-bold"
              style={{ color: "var(--color-secondary)" }}
            >
              {group.label}
            </span>
            {/* Not offered for the unlabelled group: "study only the ones with no subject" is not
                a deck anybody asks for, and it is the one value the filter cannot express. */}
            {group.subject && group.subject !== subjectFilter ? (
              <button
                type="button"
                onClick={() => onFilter(group.subject)}
                className="shrink-0 cursor-pointer rounded-[var(--radius-card)] px-1.5 py-1 text-xs font-semibold outline-none transition-colors duration-150 hover:bg-[var(--color-surface-container)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
                style={{ color: "var(--color-accent)" }}
              >
                {t("review_list_only_this")}
              </button>
            ) : null}
          </div>
          {group.rows.map((entry) => (
            <ListRow
              key={entry.id}
              entry={entry}
              current={entry.id === currentId}
              done={answered.has(entry.id)}
              onPick={() => onPick(entry.id)}
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
