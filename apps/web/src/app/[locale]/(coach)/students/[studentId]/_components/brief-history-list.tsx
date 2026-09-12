"use client";

import { useCallback, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ApiClientError } from "@mentor/api-client";
import type { MentorshipBriefHistoryItemDto } from "@mentor/types";
import { Button } from "@mentor/ui";
import { fetchBriefHistory } from "@/lib/mentorship";
import { formatDate } from "../../../_components/mentorship-format";
import { BriefDeltaBand } from "./brief-delta-band";

const PAGE_SIZE = 5;

/**
 * The briefs this coach was shown about this student before today (APP-093).
 *
 * Loads on demand, never on mount. The card above it already refuses to request anything a coach
 * did not ask for, and a history that fetched itself would put a request behind every page view
 * of a panel most coaches open to read one number.
 *
 * Reading is free (no model, no quota) — charging to re-read what a coach was already told would
 * make the memory the one thing they avoid opening.
 */
export function BriefHistoryList({ studentId }: { studentId: string }) {
  const t = useTranslations("mentorship");
  const common = useTranslations("common");
  const locale = useLocale();
  const [items, setItems] = useState<MentorshipBriefHistoryItemDto[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (next: number) => {
      setBusy(true);
      setError(null);
      try {
        const result = await fetchBriefHistory(studentId, next, PAGE_SIZE);
        setItems((current) =>
          next === 1 ? result.items : [...(current ?? []), ...result.items],
        );
        setTotal(result.total);
        setPage(result.page);
      } catch (err) {
        // The API localizes its own messages, this one included.
        setError(err instanceof ApiClientError ? err.message : common("error_unknown"));
      } finally {
        setBusy(false);
      }
    },
    [common, studentId],
  );

  if (items === null) {
    return (
      <div className="flex flex-col items-start gap-2">
        <Button type="button" variant="soft" busy={busy} onClick={() => void load(1)}>
          {t("brief_history_open")}
        </Button>
        {error ? (
          <p role="alert" className="text-sm" style={{ color: "var(--color-danger)" }}>
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
        {t("brief_history_empty")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold" style={{ color: "var(--color-main)" }}>
        {t("brief_history_title")}
      </h3>
      <ul className="flex flex-col divide-y divide-[var(--color-border)]">
        {items.map((item) => {
          const open = openId === item.id;
          return (
            <li key={item.id} className="py-3 first:pt-0 last:pb-0">
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpenId(open ? null : item.id)}
                className="w-full rounded-[var(--radius-card)] text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
              >
                <span className="text-xs" style={{ color: "var(--color-secondary)" }}>
                  {formatDate(item.generatedAt, locale)}
                </span>
                <span
                  className={`mt-1 block text-sm ${open ? "" : "line-clamp-2"}`}
                  style={{ color: "var(--color-body)" }}
                >
                  {item.brief}
                </span>
              </button>
              {open && item.delta ? (
                <div className="mt-2">
                  <BriefDeltaBand delta={item.delta} />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {error ? (
        <p role="alert" className="text-sm" style={{ color: "var(--color-danger)" }}>
          {error}
        </p>
      ) : null}
      {items.length < total ? (
        <Button type="button" variant="secondary" busy={busy} onClick={() => void load(page + 1)}>
          {t("brief_history_more")}
        </Button>
      ) : null}
    </div>
  );
}
