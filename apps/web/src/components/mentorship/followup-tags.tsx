"use client";

import { Check, Clock, MessageSquare } from "lucide-react";
import { useTranslations } from "next-intl";
import type {
  MentorshipFollowupResponse,
  MentorshipFollowupStatus,
} from "@mentor/types";

const TAG =
  "inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-[var(--radius-card)] px-2 text-xs font-extrabold";
const NEUTRAL = "bg-[var(--color-surface-container)] text-[var(--color-body)]";
const DONE = "bg-[color-mix(in_srgb,var(--color-success)_14%,var(--color-surface))] text-[var(--color-success)]";
const ASKED = "bg-[var(--play-selected)] text-[var(--play-selected-ink)]";

/**
 * Where a follow-up stands, on the coach's side, as small tags rather than outlined pills (the
 * panel's language). The student's screen keeps its own `FollowupStatus`.
 */
export function FollowupStatusTag({ status }: { status: MentorshipFollowupStatus }) {
  const t = useTranslations("mentorship");
  return (
    <span className={`${TAG} ${status === "COMPLETED" ? DONE : NEUTRAL}`}>
      {status === "COMPLETED" ? <Check className="size-3.5" strokeWidth={3} aria-hidden /> : null}
      {t(`followup_status_${status}`)}
    </span>
  );
}

/**
 * Where the student stands on the shared decision, said from the coach's side ("Kabul etti");
 * drawn only when there is one. The student's own screen keeps its "Kabul edildi" keys.
 */
export function FollowupResponseTag({ response }: { response: MentorshipFollowupResponse }) {
  const t = useTranslations("mentorship");
  const Icon = response === "ACCEPTED" ? Check : response === "CHANGE_REQUESTED" ? MessageSquare : Clock;
  const label =
    response === "ACCEPTED"
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
