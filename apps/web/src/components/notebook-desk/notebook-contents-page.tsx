"use client";

import { useTranslations } from "next-intl";
import type { NotebookContentsDto, NotebookContentsPageDto } from "@mentor/types";
import { NotebookPageSurface } from "@/components/notebook/notebook-surface";
import { deskTapeColor } from "@/lib/notebook-desk";

/**
 * "İçindekiler": the first right-hand page a notebook opens on.
 *
 * One line per page that has anything on it, in the student's own words where there are any (the
 * first line of a note), else in their own filing (the topic their cards were filed under). A line
 * is a way in: it turns the book to that page.
 *
 * Drawn on plain paper with rules of its own, one per line, instead of the writing pages' ruling:
 * the contents are set on lines of their own height, and a handwritten title crossed by a rule
 * through its middle reads as a mistake.
 */

/** Lines a page holds before the rest is summed up as "and N more pages". */
const VISIBLE_LINES = 12;

export function contentsLineTitle(
  page: NotebookContentsPageDto,
  fallbacks: {
    cards: (count: number) => string;
    ink: string;
    stickers: string;
    page: (number: number) => string;
  },
): string {
  if (page.noteTitle) return page.noteTitle;
  if (page.topicName) return page.topicName;
  if (page.subjectName) return page.subjectName;
  if (page.entryCount > 0) return fallbacks.cards(page.entryCount);
  if (page.inkCount > 0) return fallbacks.ink;
  if (page.stickerCount > 0) return fallbacks.stickers;
  return fallbacks.page(page.pageIndex + 1);
}

export function NotebookContentsPage({
  contents,
  failed = false,
  onOpenPage,
  onStart,
  coil = false,
}: {
  /** Null while the contents are on their way. */
  contents: NotebookContentsDto | null;
  failed?: boolean;
  /** A page shown on its own (a phone) carries its own coil, like every other single page. */
  coil?: boolean;
  /** Turns the book to a page. Absent where the page is only being shown (the flying book). */
  onOpenPage?: (pageIndex: number) => void;
  /** The empty contents page's way in: turn to the first page and start writing. */
  onStart?: () => void;
}) {
  const t = useTranslations("notebook.contents");
  const pages = contents?.pages ?? [];
  const visible = pages.slice(0, VISIBLE_LINES);
  const hidden = pages.length - visible.length;
  const fallbacks = {
    cards: (count: number) => t("untitled_cards", { count }),
    ink: t("untitled_ink"),
    stickers: t("untitled_stickers"),
    page: (number: number) => t("untitled", { page: number }),
  };

  return (
    <NotebookPageSurface paper="plain" coil={coil}>
      <div className="nb-contents-margin" aria-hidden="true" />
      <div className="nb-contents">
        <h2 className="nb-contents-heading">{t("heading")}</h2>
        {contents === null && !failed ? (
          <ul className="nb-contents-list" aria-busy="true" aria-label={t("loading")}>
            {[72, 54, 64, 46].map((width) => (
              <li key={width} className="nb-contents-row nb-contents-row-skeleton">
                <span
                  className="mentor-skeleton-shimmer nb-contents-skeleton"
                  style={{ width: `${width}%` }}
                />
              </li>
            ))}
          </ul>
        ) : failed ? (
          <p className="nb-contents-empty">{t("error")}</p>
        ) : pages.length === 0 ? (
          <>
            <p className="nb-contents-empty">{t("empty")}</p>
            {onStart ? (
              <button type="button" className="nb-contents-start" onClick={onStart}>
                {t("start")}
              </button>
            ) : null}
          </>
        ) : (
          <>
            <ol className="nb-contents-list">
              {visible.map((page) => {
                const title = contentsLineTitle(page, fallbacks);
                const number = page.pageIndex + 1;
                const body = (
                  <>
                    <span
                      className="nb-contents-dot"
                      aria-hidden="true"
                      style={{
                        background: page.subjectRef
                          ? deskTapeColor(page.subjectRef)
                          : "#d8cdb8",
                      }}
                    />
                    <span className="nb-contents-title">{title}</span>
                    {page.dueCount > 0 ? (
                      <span className="nb-contents-due">
                        {t("due", { count: page.dueCount })}
                      </span>
                    ) : null}
                    <span className="nb-contents-leader" aria-hidden="true" />
                    <span className="nb-contents-number">{number}</span>
                  </>
                );
                return (
                  <li key={page.pageIndex}>
                    {onOpenPage ? (
                      <button
                        type="button"
                        className="nb-contents-row"
                        aria-label={t("line_label", { title, page: number })}
                        onClick={() => onOpenPage(page.pageIndex)}
                      >
                        {body}
                      </button>
                    ) : (
                      <span className="nb-contents-row">{body}</span>
                    )}
                  </li>
                );
              })}
            </ol>
            {hidden > 0 ? (
              <p className="nb-contents-more">{t("more", { count: hidden })}</p>
            ) : null}
          </>
        )}
      </div>
    </NotebookPageSurface>
  );
}
