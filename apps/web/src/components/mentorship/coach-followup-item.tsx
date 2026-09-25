"use client";

import { useId, useRef, useState } from "react";
import { Check, ChevronDown, Lock, UsersRound } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { MentorshipFollowupDto } from "@mentor/types";
import { Button } from "@mentor/ui";
import { DateField } from "@/components/date-field";
import { updateFollowup } from "@/lib/mentorship-followups";
import { istanbulDate } from "@/lib/mentorship-followup-state";
import { PANEL_LINK_BUTTON, PANEL_QUIET_BUTTON } from "./coach-ui";
import { FollowupResponseTag, FollowupStatusTag } from "./followup-tags";

const BLOCK = "flex min-w-0 flex-col gap-1 rounded-[var(--radius-card)] px-3.5 py-3";
const BLOCK_LABEL = "inline-flex items-center gap-1.5 text-caption font-extrabold";
const BLOCK_TEXT = "whitespace-pre-wrap break-words text-body-sm text-[var(--color-body)]";

/**
 * One follow-up in the side panel, as an accordion row (canvas "Panel · Takip"): closed, a line
 * with its tags and the day that matters; open, what only the coach sees and what the student sees
 * in two visibly different blocks, then the date and the actions.
 */
export function CoachFollowupItem({
  item,
  open,
  onToggle,
  onChanged,
  onError,
  onReplace,
}: {
  item: MentorshipFollowupDto;
  open: boolean;
  onToggle: () => void;
  onChanged: () => void;
  onError: (error: unknown) => void;
  onReplace: () => void;
}) {
  const t = useTranslations("mentorship");
  const format = useFormatter();
  const bodyId = useId();
  const [date, setDate] = useState(item.followUpDate ?? "");
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  // A calendar day is read at noon UTC so no browser time zone moves it; a timestamp as it is.
  const day = (value: string) =>
    format.dateTime(new Date(value.length === 10 ? `${value}T12:00:00.000Z` : value), {
      day: "numeric",
      month: "long",
    });
  const when =
    item.status === "OPEN"
      ? item.followUpDate
        ? t("followup_check_on", { date: day(item.followUpDate) })
        : day(item.createdAt)
      : day(item.closedAt ?? item.updatedAt);

  async function mutate(status?: "COMPLETED" | "CANCELLED") {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    try {
      await updateFollowup(item.studentId, item.id, {
        version: item.version,
        ...(status ? { status } : { followUpDate: date || null }),
      });
      onChanged();
    } catch (failure) {
      onError(failure);
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }

  const tags = (
    <>
      <FollowupStatusTag status={item.status} />
      {item.sharedDecision !== null ? <FollowupResponseTag response={item.response} /> : null}
    </>
  );

  return (
    <li className="border-t border-[var(--play-line)]">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={open ? bodyId : undefined}
          onClick={onToggle}
          className="flex min-h-13 w-full cursor-pointer items-center justify-between gap-3 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        >
          <span className="flex min-w-0 flex-col gap-1.5">
            <span className="text-base font-extrabold leading-snug text-[var(--color-main)]">{item.title}</span>
            {open ? null : <span className="flex flex-wrap gap-1.5">{tags}</span>}
          </span>
          <span className="flex shrink-0 items-center gap-1.5 text-caption font-semibold text-[var(--color-secondary)]">
            {open ? null : when}
            <ChevronDown
              className={`size-4 transition-transform duration-150 motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
              aria-hidden
            />
          </span>
        </button>
      </h3>

      {open ? (
        <div id={bodyId} className="flex flex-col gap-3 pb-4">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            {tags}
            <span className="text-caption font-semibold text-[var(--color-secondary)]">
              {t("followup_opened_on", { date: day(item.createdAt) })}
            </span>
          </div>

          {item.privateNote ? (
            <div className={`${BLOCK} bg-[var(--color-surface-container)]`}>
              <span className={`${BLOCK_LABEL} text-[var(--color-secondary)]`}>
                <Lock className="size-3.5" aria-hidden />
                {t("followup_private_hint")}
              </span>
              <p className={BLOCK_TEXT}>{item.privateNote}</p>
            </div>
          ) : null}
          {item.sharedDecision ? (
            <div className={`${BLOCK} bg-[var(--play-selected)]`}>
              <span className={`${BLOCK_LABEL} text-[var(--play-selected-ink)]`}>
                <UsersRound className="size-3.5" aria-hidden />
                {t("followup_shared_hint")}
              </span>
              <p className={BLOCK_TEXT}>{item.sharedDecision}</p>
            </div>
          ) : null}

          {item.replacesId ? (
            <p className="text-caption text-[var(--color-secondary)]">{t("followup_replacement_hint")}</p>
          ) : null}

          {item.status === "OPEN" ? (
            <>
              <div className="max-w-72">
                <DateField
                  display="long"
                  label={t("followup_date_label")}
                  value={date}
                  min={istanbulDate()}
                  disabled={busy}
                  clearLabel={t("followup_date_clear")}
                  onChange={setDate}
                />
              </div>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                {/* Outlined: the panel's one filled button is "Takip kaydı oluştur" at its foot. */}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="min-h-11"
                  disabled={busy}
                  onClick={() => void mutate("COMPLETED")}
                >
                  <Check className="size-4" strokeWidth={3} aria-hidden />
                  {t("followup_complete")}
                </Button>
                <button
                  type="button"
                  className={PANEL_LINK_BUTTON}
                  disabled={busy || date === (item.followUpDate ?? "")}
                  onClick={() => void mutate()}
                >
                  {t("followup_reschedule")}
                </button>
                <button
                  type="button"
                  className={PANEL_QUIET_BUTTON}
                  disabled={busy}
                  onClick={() => void mutate("CANCELLED")}
                >
                  {t("followup_cancel")}
                </button>
              </div>
            </>
          ) : (
            <button type="button" className={`${PANEL_LINK_BUTTON} self-start`} onClick={onReplace}>
              {t("followup_replace")}
            </button>
          )}
        </div>
      ) : null}
    </li>
  );
}
