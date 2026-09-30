"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Button } from "@mentor/ui";
import type { MentorshipSharedFollowupDto } from "@mentor/types";
import { fetchSharedFollowups, respondToFollowup } from "@/lib/mentorship-followups";
import { useFollowupPage } from "@/components/mentorship/use-followup-page";
import { FollowupPageState, FollowupPagination } from "@/components/mentorship/followup-page-state";
import { FollowupResponseTag, FollowupStatusTag } from "@/components/mentorship/followup-tags";
import { PANEL_LINK_BUTTON } from "@/components/mentorship/coach-ui";
import { PANEL_CARD, PANEL_CARD_TITLE } from "@/components/panel/panel-styles";

/**
 * "Ortak kararlarımız": what the coach chose to share, and the student's answer to each. The first
 * decision still waiting on them carries the page's one filled ledge; any later one gets the
 * outline ledge, so the page never asks for two things at once. Answered (accepted or pushed back
 * on), nothing is filled. The pressed control leaves with its answer, so focus moves to what that
 * row still offers.
 */
export function SharedFollowupsCard() {
  const t = useTranslations("mentorship");
  const format = useFormatter();
  const titleId = useId();
  const load = useCallback((page: number, signal: AbortSignal) => fetchSharedFollowups(page, 10, signal), []);
  const resource = useFollowupPage<MentorshipSharedFollowupDto>(load);
  const [busy, setBusy] = useState<string | null>(null);
  const locked = useRef(false);
  const rows = useRef(new Map<string, HTMLLIElement>());
  /** After an answer: the row, and the other answer, which is what that row still offers. */
  const refocus = useRef<{ id: string; action: "ACCEPTED" | "CHANGE_REQUESTED" } | null>(null);

  useEffect(() => {
    const target = refocus.current;
    if (!target || busy !== null) return;
    const next = rows.current
      .get(target.id)
      ?.querySelector<HTMLElement>(`[data-followup-action="${target.action}"]:not([disabled])`);
    if (!next) return; // not drawn yet: the reloaded list will run this again
    next.focus();
    refocus.current = null;
  }, [resource.data, busy]);

  async function respond(item: MentorshipSharedFollowupDto, response: "ACCEPTED" | "CHANGE_REQUESTED") {
    if (locked.current) return;
    locked.current = true;
    setBusy(item.id);
    try {
      await respondToFollowup(item.id, { version: item.version, response });
      refocus.current = {
        id: item.id,
        action: response === "ACCEPTED" ? "CHANGE_REQUESTED" : "ACCEPTED",
      };
      resource.reload();
    } catch (failure) {
      resource.showError(failure);
    } finally {
      locked.current = false;
      setBusy(null);
    }
  }

  if (resource.enabled === false) return null;
  const items = resource.data?.items ?? [];
  const firstOpen = items.find((item) => item.status === "OPEN" && item.response === "PENDING")?.id;
  const day = (value: string) =>
    format.dateTime(new Date(value.length === 10 ? `${value}T12:00:00.000Z` : value), {
      day: "numeric",
      month: "long",
    });

  return (
    <section aria-labelledby={titleId} className={`${PANEL_CARD} flex flex-col gap-1`}>
      <div className="flex items-center justify-between gap-3">
        <h2 id={titleId} className={PANEL_CARD_TITLE}>
          {t("followup_shared_title")}
        </h2>
        {resource.data && resource.data.total > 0 ? (
          <span className="text-caption font-bold tabular-nums text-[var(--color-secondary)]">
            {t("followup_shared_count", { count: resource.data.total })}
          </span>
        ) : null}
      </div>
      <p className="mb-1.5 text-caption font-semibold text-[var(--color-secondary)]">{t("followup_shared_body")}</p>
      <FollowupPageState loading={resource.loading} error={resource.error} retry={resource.reload}>
        {items.length === 0 ? (
          <p className="text-body-sm font-semibold text-[var(--color-secondary)]">{t("followup_shared_empty")}</p>
        ) : (
          <ul>
            {items.map((item) => (
              <li
                key={item.id}
                ref={(node) => {
                  if (node) rows.current.set(item.id, node);
                  else rows.current.delete(item.id);
                }}
                className="flex flex-col gap-2.5 border-t border-[var(--play-line)] py-3.5 first:border-t-0 first:pt-1"
              >
                <p className="whitespace-pre-wrap break-words text-body-sm font-extrabold text-[var(--color-main)]">
                  {item.sharedDecision}
                </p>
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                  {item.status === "OPEN" ? (
                    <FollowupResponseTag response={item.response} you />
                  ) : (
                    <FollowupStatusTag status={item.status} />
                  )}
                  {item.followUpDate ? (
                    <span className="text-caption font-semibold text-[var(--color-secondary)]">
                      {t("followup_due", { date: day(item.followUpDate) })}
                    </span>
                  ) : null}
                </div>
                {item.status === "OPEN" ? (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    {item.response !== "ACCEPTED" ? (
                      <Button
                        data-followup-action="ACCEPTED"
                        size="sm"
                        variant={item.id === firstOpen ? "primary" : "secondary"}
                        busy={busy === item.id}
                        disabled={busy !== null}
                        onClick={() => void respond(item, "ACCEPTED")}
                      >
                        {t("followup_accept")}
                      </Button>
                    ) : null}
                    {item.response !== "CHANGE_REQUESTED" ? (
                      <button
                        type="button"
                        data-followup-action="CHANGE_REQUESTED"
                        className={PANEL_LINK_BUTTON}
                        disabled={busy !== null}
                        onClick={() => void respond(item, "CHANGE_REQUESTED")}
                      >
                        {t("followup_request_change")}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {resource.data ? <FollowupPagination {...resource.data} quiet onChange={resource.setPage} /> : null}
      </FollowupPageState>
    </section>
  );
}
