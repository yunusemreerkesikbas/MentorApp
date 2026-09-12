"use client";

import { useState } from "react";
import type { MentorshipFollowupDto, MentorshipFollowupStatus } from "@mentor/types";
import { Button, Card, TextField } from "@mentor/ui";
import { useLocale, useTranslations } from "next-intl";

import { FollowupStatus } from "@/components/mentorship/followup-status";
import { istanbulDate } from "@/lib/mentorship-followup-state";
import { updateMentorshipFollowup } from "@/lib/mentorship-followups";
import { formatDate } from "../../../_components/mentorship-format";

export function FollowupHistoryItem({
  studentId,
  item,
  onChanged,
  onReplace,
  onError,
}: {
  studentId: string;
  item: MentorshipFollowupDto;
  onChanged: () => void;
  onReplace: (item: MentorshipFollowupDto) => void;
  onError: (failure: unknown) => void;
}) {
  const t = useTranslations("mentorship");
  const locale = useLocale();
  const [date, setDate] = useState(item.followUpDate ?? "");
  const [busyAction, setBusyAction] = useState<"date" | MentorshipFollowupStatus | null>(null);

  async function saveDate() {
    setBusyAction("date");
    try {
      await updateMentorshipFollowup(studentId, item.id, {
        version: item.version,
        followUpDate: date || null,
      });
      onChanged();
    } catch (failure) {
      onError(failure);
    } finally {
      setBusyAction(null);
    }
  }

  async function close(status: "COMPLETED" | "CANCELLED") {
    setBusyAction(status);
    try {
      await updateMentorshipFollowup(studentId, item.id, {
        version: item.version,
        status,
      });
      onChanged();
    } catch (failure) {
      onError(failure);
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold" style={{ color: "var(--color-main)" }}>
            {item.title}
          </h3>
          <p className="mt-1 text-xs" style={{ color: "var(--color-secondary)" }}>
            {t("followup_created", { date: formatDate(item.createdAt, locale) })}
          </p>
        </div>
        <FollowupStatus status={item.status} response={item.response} />
      </div>

      <dl className="mt-4 flex flex-col gap-4">
        <div>
          <dt className="text-xs font-semibold" style={{ color: "var(--color-secondary)" }}>
            {t("followup_private_label")}
          </dt>
          <dd className="mt-1 whitespace-pre-line text-sm" style={{ color: "var(--color-body)" }}>
            {item.privateNote ?? t("followup_private_empty")}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold" style={{ color: "var(--color-secondary)" }}>
            {t("followup_shared_label")}
          </dt>
          <dd className="mt-1 whitespace-pre-line text-sm" style={{ color: "var(--color-body)" }}>
            {item.sharedDecision ?? t("followup_shared_empty")}
          </dd>
        </div>
      </dl>

      {item.status === "OPEN" ? (
        <div className="mt-5 border-t border-[var(--color-border)] pt-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <TextField
              type="date"
              label={t("followup_date_label")}
              value={date}
              min={istanbulDate()}
              className="min-w-0 flex-1"
              onChange={(event) => setDate(event.target.value)}
            />
            <Button
              variant="secondary"
              busy={busyAction === "date"}
              disabled={(date || null) === item.followUpDate || busyAction !== null}
              onClick={() => void saveDate()}
            >
              {t("followup_date_save")}
            </Button>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              variant="soft"
              busy={busyAction === "COMPLETED"}
              disabled={busyAction !== null}
              onClick={() => void close("COMPLETED")}
            >
              {t("followup_complete")}
            </Button>
            <Button
              variant="ghost"
              busy={busyAction === "CANCELLED"}
              disabled={busyAction !== null}
              onClick={() => void close("CANCELLED")}
            >
              {t("followup_cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-5 border-t border-[var(--color-border)] pt-4">
          <Button variant="secondary" onClick={() => onReplace(item)}>
            {t("followup_replace_action")}
          </Button>
        </div>
      )}
    </Card>
  );
}
