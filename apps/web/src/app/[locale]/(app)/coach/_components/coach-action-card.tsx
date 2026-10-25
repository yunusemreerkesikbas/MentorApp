"use client";
import { Sparkles } from "lucide-react";

import { useEffect, useState, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import {
  CoachActionStatus,
  CoachActionType,
  type CoachActionDto,
  type CoachActionStatus as CoachActionStatusValue,
} from "@mentor/types";
import { SuccessCheck } from "@mentor/ui";
import { useRouter } from "@/i18n/navigation";
import { decideCoachAction } from "@/lib/coach";
import { buildStudySessionHrefFromPlanTask } from "@/lib/plan-study-session-link";
import { trackCoachEvent } from "@/lib/analytics";

const DESTINATION = {
  ANALYSIS: "/analysis",
  MOOD: "/dashboard",
  GOAL: "/vision-board",
} as const;

export function CoachActionCard({
  messageId,
  action,
  status,
  onStatusChange,
}: {
  messageId: string;
  action: CoachActionDto;
  status: CoachActionStatusValue;
  onStatusChange: (status: CoachActionStatusValue) => void;
}) {
  const t = useTranslations("coach_chat.actions");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (status === CoachActionStatus.PROPOSED) {
      trackCoachEvent("coach_v2_action", {
        action_type: action.type,
        status: "IMPRESSION",
      });
    }
  }, [action.type, status]);

  async function decide(decision: "ACCEPT" | "CANCEL") {
    if (busy) return;
    setBusy(true);
    setError(false);
    try {
      const result = await decideCoachAction(messageId, { decision });
      onStatusChange(result.status);
      trackCoachEvent("coach_v2_action", {
        action_type: action.type,
        status: result.status,
      });
      if (decision !== "ACCEPT") return;
      if (action.type === CoachActionType.NAVIGATE) {
        router.push(DESTINATION[action.payload.destination]);
      } else if (action.type === CoachActionType.OPEN_PLAN_ADAPTATION) {
        router.push({
          pathname: "/plan",
          query: { adaptation: "1", source: action.payload.source },
        });
      } else if (action.type === CoachActionType.START_PLAN_SESSION) {
        const href = buildStudySessionHrefFromPlanTask(
          {
            id: action.payload.planTaskId,
            title: "",
            subject: result.session?.subject ?? null,
            sessionFocusMinutes:
              result.session?.plannedFocusMinutes ?? undefined,
          },
          "coach",
        );
        router.push({
          ...href,
          query: {
            ...href.query,
            ...(result.session ? { preset: result.session.preset } : {}),
            ...(result.resultRefId && !result.session?.endedAt
              ? { sessionId: result.resultRefId, autostart: "1" }
              : {}),
          },
        });
      }
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  if (
    status === CoachActionStatus.ACCEPTED ||
    status === CoachActionStatus.COMPLETED
  ) {
    return (
      <div className="flex max-w-[85%] items-center gap-2 rounded-[var(--radius-card)] bg-[color-mix(in_srgb,var(--color-surface)_72%,transparent)] px-3 py-2 text-sm text-[var(--color-body-text)] shadow-[var(--shadow-card)] backdrop-blur-md">
        <SuccessCheck
          state="in"
          size={18}
          stroke="var(--color-progress)"
          style={
            {
              ["--check-y-amount" as string]: "8px",
              ["--check-blur-from" as string]: "4px",
              ["--check-rotate-from" as string]: "40deg",
            } as CSSProperties
          }
        />
        <span>
          {t(status === CoachActionStatus.COMPLETED ? "completed" : "accepted")}
        </span>
      </div>
    );
  }
  if (status === CoachActionStatus.CANCELLED) return null;

  return (
    // Same language as the first-visit preference card: glass card, blue pill, quiet text button.
    <div className="flex max-w-[85%] flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-[var(--radius-card)] bg-[color-mix(in_srgb,var(--color-surface)_92%,transparent)] py-2.5 pl-4 pr-2.5 shadow-[var(--shadow-card)] backdrop-blur-md">
      <p className="flex min-w-0 items-center gap-2 text-sm font-semibold text-[var(--color-main)]">
        <Sparkles className="size-4 shrink-0 text-[var(--color-progress)]" aria-hidden />
        {action.label}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={busy}
          onClick={() => void decide("CANCEL")}
          className="min-h-11 cursor-pointer rounded-full px-3.5 text-sm font-semibold text-[var(--color-secondary)] transition-colors hover:text-[var(--color-main)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:opacity-50 motion-reduce:transition-none"
        >
          {t("dismiss")}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void decide("ACCEPT")}
          className="min-h-11 cursor-pointer rounded-full bg-[var(--color-progress)] px-5 text-sm font-bold text-white shadow-[var(--shadow-card)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
        >
          {t("approve")}
        </button>
      </div>
      {error ? (
        <p role="alert" className="text-xs text-[var(--color-danger)]">
          {t("error")}
        </p>
      ) : null}
    </div>
  );
}
