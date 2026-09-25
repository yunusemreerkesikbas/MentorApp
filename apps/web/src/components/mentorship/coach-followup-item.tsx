"use client";

import { useRef, useState } from "react";
import { Lock, UsersRound } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { MentorshipFollowupDto } from "@mentor/types";
import { Button } from "@mentor/ui";
import { DateField } from "@/components/date-field";
import { updateFollowup } from "@/lib/mentorship-followups";
import { istanbulDate } from "@/lib/mentorship-followup-state";
import { INSET_GROUP_CLASS } from "./coach-ui";
import { FollowupResponseTag, FollowupStatusTag } from "./followup-tags";

const BLOCK = "flex min-w-0 flex-col gap-1 rounded-[var(--radius-card)] px-3.5 py-3";
const BLOCK_LABEL = "inline-flex items-center gap-1.5 text-caption font-extrabold";
const BLOCK_TEXT = "whitespace-pre-wrap break-words text-body-sm text-[var(--color-body)]";

/**
 * One follow-up in the side panel. What only the coach sees and what the student sees sit in two
 * visibly different blocks, the shared one in the selection tint, so the line between them is
 * never a matter of reading the label.
 */
export function CoachFollowupItem({
  item,
  onChanged,
  onError,
  onReplace,
}: {
  item: MentorshipFollowupDto;
  onChanged: () => void;
  onError: (error: unknown) => void;
  onReplace: () => void;
}) {
  const t = useTranslations("mentorship");
  const format = useFormatter();
  const [date, setDate] = useState(item.followUpDate ?? "");
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);

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

  return (
    <article className={`${INSET_GROUP_CLASS} flex flex-col gap-3 p-4`}>
      <div className="flex flex-col gap-1.5">
        <h3 className="text-base font-extrabold leading-snug text-[var(--color-main)]">{item.title}</h3>
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          <FollowupStatusTag status={item.status} />
          {item.sharedDecision !== null ? <FollowupResponseTag response={item.response} /> : null}
          <span className="text-caption font-semibold text-[var(--color-secondary)]">
            {format.dateTime(new Date(item.createdAt), { day: "numeric", month: "long", year: "numeric" })}
          </span>
        </div>
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
        // Two rows: rescheduling changes the record, closing it ends it, and a panel is too narrow to
        // hold both groups on one line without the last button falling onto a row of its own.
        <div className="flex flex-col gap-3 border-t border-[var(--play-line)] pt-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-0 flex-1 sm:max-w-52">
              <DateField
                label={t("followup_date_label")}
                value={date}
                min={istanbulDate()}
                disabled={busy}
                clearLabel={t("followup_date_clear")}
                onChange={setDate}
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="min-h-11"
              disabled={busy || date === (item.followUpDate ?? "")}
              onClick={() => void mutate()}
            >
              {t("followup_reschedule")}
            </Button>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-11"
              disabled={busy}
              onClick={() => void mutate("CANCELLED")}
            >
              {t("followup_cancel")}
            </Button>
            {/* Outlined: the panel's one filled button is "Takip kaydı oluştur" at its foot. */}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="min-h-11"
              disabled={busy}
              onClick={() => void mutate("COMPLETED")}
            >
              {t("followup_complete")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex justify-end border-t border-[var(--play-line)] pt-3">
          <Button type="button" variant="secondary" size="sm" className="min-h-11" onClick={onReplace}>
            {t("followup_replace")}
          </Button>
        </div>
      )}
    </article>
  );
}
