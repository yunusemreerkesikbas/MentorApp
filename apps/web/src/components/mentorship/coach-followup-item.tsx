"use client";

import { useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { MentorshipFollowupDto } from "@mentor/types";
import { Button } from "@mentor/ui";
import { DateField } from "@/components/date-field";
import { updateFollowup } from "@/lib/mentorship-followups";
import { istanbulDate } from "@/lib/mentorship-followup-state";
import { COACH_POPOVER_CLASS, INSET_GROUP_CLASS } from "./coach-ui";
import { FollowupStatus } from "./followup-status";

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
  const locale = useLocale();
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="coach-body font-semibold text-[var(--color-main)]">{item.title}</h3>
          <p className="coach-footnote text-[var(--color-secondary)]">
            {new Date(item.createdAt).toLocaleDateString(locale, {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
        <FollowupStatus
          status={item.status}
          response={item.response}
          shared={item.sharedDecision !== null}
        />
      </div>

      {item.privateNote || item.sharedDecision ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {item.privateNote ? (
            <div className="flex min-w-0 flex-col gap-1">
              <p className="coach-caption font-semibold text-[var(--color-secondary)]">
                {t("followup_private_hint")}
              </p>
              <p className="coach-body whitespace-pre-wrap break-words text-[var(--color-body)]">
                {item.privateNote}
              </p>
            </div>
          ) : null}
          {item.sharedDecision ? (
            <div className="flex min-w-0 flex-col gap-1">
              <p className="coach-caption font-semibold text-[var(--coach-accent-text)]">
                {t("followup_shared_hint")}
              </p>
              <p className="coach-body whitespace-pre-wrap break-words text-[var(--color-body)]">
                {item.sharedDecision}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {item.replacesId ? (
        <p className="coach-footnote text-[var(--color-secondary)]">{t("followup_replacement_hint")}</p>
      ) : null}

      {item.status === "OPEN" ? (
        // Two rows: rescheduling changes the record, closing it ends it, and a panel is too narrow to
        // hold both groups on one line without the last button falling onto a row of its own.
        <div className="flex flex-col gap-3 border-t border-[var(--color-border)] pt-3">
          <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1 sm:max-w-52">
            <DateField
              label={t("followup_date_label")}
              value={date}
              min={istanbulDate()}
              disabled={busy}
              clearLabel={t("followup_date_clear")}
              menuClassName={COACH_POPOVER_CLASS}
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
          <Button
            type="button"
            variant="soft"
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
        <div className="flex justify-end border-t border-[var(--color-border)] pt-3">
          <Button type="button" variant="secondary" size="sm" className="min-h-11" onClick={onReplace}>
            {t("followup_replace")}
          </Button>
        </div>
      )}
    </article>
  );
}
