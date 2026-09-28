"use client";

import { Check, Clock, MessageSquare } from "lucide-react";
import { useTranslations } from "next-intl";
import type {
  MentorshipFollowupResponse,
  MentorshipFollowupStatus,
} from "@mentor/types";
import { CoachCheck } from "./coach-check";

const TAG =
  "inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-[var(--radius-card)] px-2 text-xs font-extrabold";
const NEUTRAL = "bg-[var(--color-surface-container)] text-[var(--color-body)]";
const DONE = "bg-[color-mix(in_srgb,var(--color-success)_14%,var(--color-surface))] text-[var(--color-success)]";
const ASKED = "bg-[var(--play-selected)] text-[var(--play-selected-ink)]";

/**
 * Where a follow-up stands, as small tags rather than outlined pills (the panel's language), on
 * the coach's side and on the student's Koçum alike. `drawCheck`: the coach
 * completed it just now, so the ✓ draws. (A changed record is a new row, keyed by its version, so the
 * word is simply the new one.)
 */
export function FollowupStatusTag({
  status,
  drawCheck = false,
}: {
  status: MentorshipFollowupStatus;
  drawCheck?: boolean;
}) {
  const t = useTranslations("mentorship");
  return (
    <span className={`${TAG} ${status === "COMPLETED" ? DONE : NEUTRAL}`}>
      {status === "COMPLETED" ? (
        <CoachCheck draw={drawCheck} className="size-3.5" />
      ) : null}
      {t(`followup_status_${status}`)}
    </span>
  );
}

/**
 * Where the student stands on the shared decision, said from the coach's side ("Kabul etti"), or
 * with `you` to the student themselves on Koçum ("Kabul ettin", "Yanıtını bekliyor").
 */
export function FollowupResponseTag({
  response,
  you = false,
}: {
  response: MentorshipFollowupResponse;
  you?: boolean;
}) {
  const t = useTranslations("mentorship");
  const Icon = response === "ACCEPTED" ? Check : response === "CHANGE_REQUESTED" ? MessageSquare : Clock;
  const label = you
    ? t(`followup_you_${response}`)
    : response === "ACCEPTED"
      ? t("followup_coach_accepted")
      : response === "CHANGE_REQUESTED"
        ? t("followup_changes_requested")
        : t("followup_response_PENDING");
  return (
    <span className={`${TAG} ${response === "ACCEPTED" ? DONE : ASKED}`}>
      <Icon className="size-3.5" strokeWidth={response === "ACCEPTED" ? 3 : 2} aria-hidden />
      {label}
    </span>
  );
}
