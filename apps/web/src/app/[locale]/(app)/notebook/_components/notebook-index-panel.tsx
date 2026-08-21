"use client";

import { useCallback, useEffect, useId, useState } from "react";
import Image from "next/image";
import { Check, FileText, LayoutGrid } from "lucide-react";
import { useTranslations } from "next-intl";
import type {
  ExamSubjectDto,
  NotebookEntryDto,
  NotebookErrorType,
} from "@mentor/types";
import { NOTEBOOK_ERROR_TYPES } from "@mentor/types";
import { MenuSelect } from "@/components/menu-select";
import { FormError } from "@/components/form";
import { NotebookCompactButton } from "@/components/notebook/notebook-compact-button";
import { fetchNotebookEntries } from "@/lib/notebook";

/**
 * Every mistake in the book, newest first — the screen that can reach an entry the others cannot.
 *
 * The pages only show what has been arranged onto them and the review deck only what is due today,
 * so a card taken off a page (or never placed, because the page was full) had nowhere left to be
 * seen. It still came back when its review fell due, but until then it could not be corrected or
 * deleted, because both of those are reached by double-clicking a card that no longer existed.
 *
 * Filtering is by subject, error type and status — the two the entry table is already indexed for
 * plus the one that answers "what have I actually healed". Searching inside notes is deliberately
 * absent: it would be an unindexed scan, and a trigram index is a migration with its own reasons.
 *
 * ponytail: a "show more" button, not infinite scroll. The panel is a narrow rail column and the
 * page count is small; a scroll observer would be machinery for a list nobody scrolls far into.
 */

const PAGE_SIZE = 20;

export interface NotebookIndexPanelProps {
  subjects: ExamSubjectDto[];
  /** Entry ids already arranged on one of the two open pages — they cannot be placed twice. */
  placedEntryIds: ReadonlySet<string>;
  /** Bumped by the shell whenever an entry is edited or deleted, so the list cannot go stale. */
  refreshKey: number;
  onOpen: (entry: NotebookEntryDto) => void;
  onPlace: (entry: NotebookEntryDto) => void;
}

export function NotebookIndexPanel({
  subjects,
  placedEntryIds,
  refreshKey,
  onOpen,
  onPlace,
}: NotebookIndexPanelProps) {
  const t = useTranslations("notebook");
  const reactId = useId();
  const subjectLabelId = `notebook-index-subject-${reactId}`;
  const errorLabelId = `notebook-index-error-${reactId}`;
  const statusLabelId = `notebook-index-status-${reactId}`;

  const [subjectRef, setSubjectRef] = useState("");
  const [errorType, setErrorType] = useState("");
  const [status, setStatus] = useState("");
  const [items, setItems] = useState<NotebookEntryDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  /** Only the "show more" press — the first page keeps the previous rows on screen while it loads. */
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(
    (nextPage: number) =>
      fetchNotebookEntries({
        page: nextPage,
        pageSize: PAGE_SIZE,
        ...(subjectRef ? { subjectRef } : {}),
        ...(errorType ? { errorType: errorType as NotebookErrorType } : {}),
        ...(status ? { status: status as "ACTIVE" | "HEALED" } : {}),
      }),
    [errorType, status, subjectRef],
  );

  /**
   * Filters and outside edits both mean "the first page is no longer what the server would send".
   *
   * The `cancelled` flag is not ceremony: changing two filters quickly starts two requests, and
   * without it the slower one can land last and paint results for a filter nobody is looking at.
   * Nothing is set synchronously here either — the previous rows stay put until the new ones
   * arrive, which reads better than blanking the list on every filter tap.
   */
  useEffect(() => {
    let cancelled = false;
    fetchPage(1)
      .then((result) => {
        if (cancelled) return;
        setItems(result.items);
        setTotal(result.total);
        setPage(1);
        setError(null);
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setError(t("error_index_load"));
      });
    return () => {
      cancelled = true;
    };
  }, [fetchPage, refreshKey, t]);

  function loadMore() {
    setBusy(true);
    setError(null);
    fetchPage(page + 1)
      .then((result) => {
        // Later pages append — the same list growing, not a new one.
        setItems((current) => [...current, ...result.items]);
        setTotal(result.total);
        setPage((current) => current + 1);
      })
      .catch(() => setError(t("error_index_load")))
      .finally(() => setBusy(false));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <span
          id={subjectLabelId}
          className="text-sm font-semibold"
          style={{ color: "var(--color-main)" }}
        >
          {t("index_filter_subject")}
        </span>
        <MenuSelect
          value={subjectRef}
          aria-labelledby={subjectLabelId}
          options={[
            { value: "", label: t("index_filter_all") },
            ...subjects.map((subject) => ({
              value: subject.slug,
              label: subject.name,
            })),
          ]}
          onChange={setSubjectRef}
        />
      </div>

      <div className="flex flex-col gap-1">
        <span
          id={errorLabelId}
          className="text-sm font-semibold"
          style={{ color: "var(--color-main)" }}
        >
          {t("index_filter_error_type")}
        </span>
        <MenuSelect
          value={errorType}
          aria-labelledby={errorLabelId}
          options={[
            { value: "", label: t("index_filter_all") },
            ...NOTEBOOK_ERROR_TYPES.map((type) => ({
              value: type,
              label: t(`error_type.${type}`),
            })),
          ]}
          onChange={setErrorType}
        />
      </div>

      <div className="flex flex-col gap-1">
        <span
          id={statusLabelId}
          className="text-sm font-semibold"
          style={{ color: "var(--color-main)" }}
        >
          {t("index_filter_status")}
        </span>
        <MenuSelect
          value={status}
          aria-labelledby={statusLabelId}
          options={[
            { value: "", label: t("index_filter_all") },
            { value: "ACTIVE", label: t("index_status_active") },
            { value: "HEALED", label: t("index_status_healed") },
          ]}
          onChange={setStatus}
        />
      </div>

      <FormError message={error} />

      {items.length === 0 && loaded ? (
        <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
          {t("index_empty")}
        </p>
      ) : null}

      <div className="flex flex-col">
        {items.map((entry) => (
          <IndexRow
            key={entry.id}
            entry={entry}
            placed={placedEntryIds.has(entry.id)}
            onOpen={() => onOpen(entry)}
            onPlace={() => onPlace(entry)}
          />
        ))}
      </div>

      {items.length < total ? (
        <NotebookCompactButton
          variant="secondary"
          fullWidth
          busy={busy}
          onClick={loadMore}
        >
          {t("index_load_more", { count: total - items.length })}
        </NotebookCompactButton>
      ) : null}
    </div>
  );
}

function IndexRow({
  entry,
  placed,
  onOpen,
  onPlace,
}: {
  entry: NotebookEntryDto;
  placed: boolean;
  onOpen: () => void;
  onPlace: () => void;
}) {
  const t = useTranslations("notebook");
  const label = entry.topicName ?? entry.subjectName ?? t("card_unlabelled");

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-h-14 min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-[var(--radius-card)] px-2 text-left outline-none transition-colors duration-150 hover:bg-[var(--color-surface-container)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
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
              unoptimized
            />
          ) : (
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

        {entry.status === "HEALED" ? (
          <Check
            aria-label={t("card_healed")}
            size={16}
            className="shrink-0"
            style={{ color: "var(--color-success)" }}
          />
        ) : null}
      </button>

      {/* A card already on one of the open pages cannot be placed again: `handleCreated` does not
          check, so a second press would put two identical cards on the same paper. */}
      <button
        type="button"
        disabled={placed}
        aria-label={placed ? t("index_already_placed") : t("index_place_on_page")}
        onClick={onPlace}
        className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full outline-none transition-colors duration-150 hover:bg-[var(--color-surface-container)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent motion-reduce:transition-none"
        style={{ color: "var(--color-main)" }}
      >
        <LayoutGrid aria-hidden size={16} />
      </button>
    </div>
  );
}
