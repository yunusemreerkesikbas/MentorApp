"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import type { CoachPlanItemDto } from "@mentor/types";
import { useLocale, useTranslations } from "next-intl";
import { isCoachPlanItemShared } from "@/lib/coach-plan-calendar";
import type { CoachTaskMutationTarget } from "@/lib/coach-plan-mutations";
import { CoachPlanAvatarStack } from "./coach-plan-avatar-stack";
import { CoachPlanDetailActions } from "./coach-plan-detail-actions";
import { CoachPlanOverlay, CoachPlanOverlayBody } from "./coach-plan-overlay";

export function CoachPlanDetail({
  item,
  onClose,
  onEdit,
  onMutationSuccess,
}: {
  item: CoachPlanItemDto;
  onClose: () => void;
  onEdit: (
    trigger: HTMLButtonElement,
    target: CoachTaskMutationTarget | null,
  ) => void;
  onMutationSuccess: (message: string) => void;
}) {
  const locale = useLocale();
  const t = useTranslations("coachPlan");
  const data = item.kind === "TASK" ? item.task : item.event;
  const date = item.kind === "TASK" ? item.task.taskDate : item.event.eventDate;
  const people = item.kind === "TASK" ? item.task.participants : item.event.attendees;
  const names = people.map((person) => person.studentDisplayName).join(", ");
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, [item]);

  return (
    <CoachPlanOverlay
      variant="inspector"
      layer="detail"
      labelledBy="coach-plan-detail-title"
      onClose={onClose}
    >
      <CoachPlanOverlayBody>
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold" style={{ color: "var(--color-secondary)" }}>
                {t(item.kind === "TASK" ? "type_task" : "type_event")} ·{" "}
                {t(isCoachPlanItemShared(item) ? "shared" : "personal")}
              </p>
              <h2
                id="coach-plan-detail-title"
                className="mt-1 text-lg font-semibold"
                style={{ color: "var(--color-main)" }}
              >
                {data.title}
              </h2>
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label={t("close_details")}
              className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-[var(--radius-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
              style={{ color: "var(--color-main)" }}
            >
              <X aria-hidden size={22} />
            </button>
          </div>
          <dl className="grid gap-3 sm:grid-cols-2">
            <Detail
              label={t("detail_date")}
              value={new Intl.DateTimeFormat(locale, {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              }).format(new Date(`${date}T12:00:00Z`))}
            />
            <Detail
              label={t("detail_time")}
              value={
                data.startTime
                  ? data.endTime
                    ? `${data.startTime}–${data.endTime}`
                    : data.startTime
                  : t("all_day")
              }
            />
            {item.kind === "TASK" && item.task.subject ? (
              <Detail
                label={t("detail_subject")}
                value={[item.task.subject, item.task.topic].filter(Boolean).join(" · ")}
              />
            ) : null}
            {item.kind === "TASK" && item.task.coachNote ? (
              <Detail label={t("detail_note")} value={item.task.coachNote} />
            ) : null}
            {item.kind === "EVENT" && item.event.description ? (
              <Detail label={t("detail_description")} value={item.event.description} />
            ) : null}
          </dl>
          {people.length > 0 ? (
            <div className="flex flex-wrap items-center gap-3">
              <CoachPlanAvatarStack
                people={people}
                label={t("participants_named", { names })}
              />
              <p className="text-sm" style={{ color: "var(--color-body)" }}>{names}</p>
            </div>
          ) : null}
          <CoachPlanDetailActions
            item={item}
            onEdit={onEdit}
            onSuccess={onMutationSuccess}
          />
        </div>
      </CoachPlanOverlayBody>
    </CoachPlanOverlay>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs" style={{ color: "var(--color-secondary)" }}>{label}</dt>
      <dd className="text-sm" style={{ color: "var(--color-body)" }}>{value}</dd>
    </div>
  );
}
