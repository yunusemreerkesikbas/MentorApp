"use client";

import { useState } from "react";
import { ApiClientError } from "@mentor/api-client";
import type {
  CoachPlanEventDto,
  MentorshipRosterRowDto,
  PlanEventMutationScope,
} from "@mentor/types";
import { Button, TextAreaField, TextField } from "@mentor/ui";
import {
  createMentorshipEventSchema,
  updateMentorshipEventSchema,
} from "@mentor/validation";
import { useTranslations } from "next-intl";
import { FormError } from "@/components/form";
import {
  buildCoachEventCreate,
  buildCoachEventUpdate,
  eventMutationScope,
} from "@/lib/coach-plan-mutations";
import {
  createCoachPlanEvent,
  updateCoachPlanEvent,
} from "@/lib/mentorship";
import { useMentorToast } from "@/lib/mentor-toast";
import { CoachPlanAttendees } from "./coach-plan-attendees";
import { CoachPlanEventScopeChoices } from "./coach-plan-event-scope";
import { CoachPlanFormPanel } from "./coach-plan-form-panel";
import {
  CoachPlanSelect,
  CoachPlanTimeFields,
} from "./coach-plan-form-fields";

type EventFormMode =
  | { kind: "CREATE"; initialDate: string }
  | { kind: "EDIT"; event: CoachPlanEventDto };

export function CoachPlanEventForm({
  mode,
  roster,
  onClose,
  onSuccess,
}: {
  mode: EventFormMode;
  roster: readonly MentorshipRosterRowDto[];
  onClose: () => void;
  onSuccess: (message: string) => void;
}) {
  const t = useTranslations("coachPlan");
  const common = useTranslations("common");
  const toast = useMentorToast();
  const editing = mode.kind === "EDIT";
  const initial = editing ? mode.event : null;
  const recurrence = initial?.recurrence;
  const [title, setTitle] = useState(initial?.title ?? "");
  const [eventDate, setEventDate] = useState(
    initial?.eventDate ?? (mode.kind === "CREATE" ? mode.initialDate : ""),
  );
  const [startTime, setStartTime] = useState(initial?.startTime ?? "");
  const [endTime, setEndTime] = useState(initial?.endTime ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [attendeeIds, setAttendeeIds] = useState(
    initial?.attendees.map((attendee) => attendee.studentId) ?? [],
  );
  const [frequency, setFrequency] = useState<
    "NONE" | "DAILY" | "WEEKLY" | "MONTHLY"
  >(recurrence?.frequency ?? "NONE");
  const [endKind, setEndKind] = useState<"COUNT" | "DATE">(
    recurrence?.end.kind ?? "COUNT",
  );
  const [count, setCount] = useState(
    recurrence?.end.kind === "COUNT" ? recurrence.end.count : 2,
  );
  const [endDate, setEndDate] = useState(
    recurrence?.end.kind === "DATE" ? recurrence.end.date : eventDate,
  );
  const [scope, setScope] = useState<PlanEventMutationScope | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const showRecurrence = mode.kind === "CREATE" ||
    Boolean(initial?.seriesId && scope === "SERIES");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const values = {
      title,
      description,
      eventDate,
      startTime,
      endTime,
      attendeeIds,
      recurrenceFrequency: frequency,
      recurrenceEndKind: endKind,
      recurrenceCount: count,
      recurrenceEndDate: endDate,
    };
    const effectiveScope = initial
      ? eventMutationScope(initial.seriesId, scope)
      : null;
    if (initial?.seriesId && !effectiveScope) {
      setError(t("scope_required"));
      return;
    }
    setBusy(true);
    try {
      if (mode.kind === "CREATE") {
        await createCoachPlanEvent(
          createMentorshipEventSchema.parse(buildCoachEventCreate(values)),
        );
      } else {
        await updateCoachPlanEvent(
          mode.event.id,
          updateMentorshipEventSchema.parse(
            buildCoachEventUpdate(values, effectiveScope!),
          ),
        );
      }
      onSuccess(t(editing ? "event_updated" : "event_created"));
    } catch (failure) {
      const message = failure instanceof ApiClientError
        ? failure.message
        : isValidationError(failure)
          ? t("validation_error")
          : common("error_unknown");
      setError(message);
      toast.error({ title: common("error_title"), message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <CoachPlanFormPanel
      title={t(editing ? "edit_event" : "new_event")}
      busy={busy}
      onClose={onClose}
    >
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <TextField
          label={t("form_title")}
          value={title}
          required
          minLength={1}
          maxLength={200}
          disabled={busy}
          onChange={(event) => setTitle(event.target.value)}
        />
        <TextField
          type="date"
          label={t("form_date")}
          value={eventDate}
          required
          disabled={busy}
          onChange={(event) => setEventDate(event.target.value)}
        />
        <CoachPlanTimeFields
          startTime={startTime}
          endTime={endTime}
          disabled={busy}
          onStartTime={setStartTime}
          onEndTime={setEndTime}
        />
        <p className="text-xs" style={{ color: "var(--color-secondary)" }}>
          {t(startTime ? "timed_reminder" : "all_day_no_reminder")}
        </p>
        <TextAreaField
          label={t("description_optional")}
          value={description}
          maxLength={2000}
          rows={3}
          disabled={busy}
          onChange={(event) => setDescription(event.target.value)}
        />
        <CoachPlanAttendees
          roster={roster}
          selectedIds={attendeeIds}
          onChange={setAttendeeIds}
        />
        {initial?.seriesId && (
          <CoachPlanEventScopeChoices value={scope} disabled={busy} onChange={setScope} />
        )}
        {showRecurrence && (
          <>
            <CoachPlanSelect
              label={t("recurrence")}
              value={frequency}
              disabled={busy}
              onChange={(event) => setFrequency(event.target.value as typeof frequency)}
            >
              {(initial?.seriesId
                ? (["DAILY", "WEEKLY", "MONTHLY"] as const)
                : (["NONE", "DAILY", "WEEKLY", "MONTHLY"] as const)
              ).map((value) => (
                <option key={value} value={value}>
                  {t(`recurrence_${value.toLowerCase()}`)}
                </option>
              ))}
            </CoachPlanSelect>
            {frequency !== "NONE" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <CoachPlanSelect
                  label={t("recurrence_end")}
                  value={endKind}
                  disabled={busy}
                  onChange={(event) => setEndKind(event.target.value as typeof endKind)}
                >
                  <option value="COUNT">{t("recurrence_count")}</option>
                  <option value="DATE">{t("recurrence_date")}</option>
                </CoachPlanSelect>
                {endKind === "COUNT" ? (
                  <TextField
                    type="number"
                    label={t("recurrence_count_label")}
                    value={count}
                    min={2}
                    max={100}
                    required
                    disabled={busy}
                    onChange={(event) => setCount(event.target.valueAsNumber)}
                  />
                ) : (
                  <TextField
                    type="date"
                    label={t("recurrence_end_date")}
                    value={endDate}
                    min={eventDate}
                    required
                    disabled={busy}
                    onChange={(event) => setEndDate(event.target.value)}
                  />
                )}
              </div>
            )}
          </>
        )}
        <FormError message={error} />
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" disabled={busy} onClick={onClose}>
            {t("form_cancel")}
          </Button>
          <Button type="submit" busy={busy}>
            {t(editing ? "save_changes" : "create_event")}
          </Button>
        </div>
      </form>
    </CoachPlanFormPanel>
  );
}

function isValidationError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "name" in error && error.name === "ZodError");
}
