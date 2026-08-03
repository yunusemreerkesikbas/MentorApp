"use client";
import { CheckCircle2, Sparkles } from "lucide-react";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CoachActionStatus,
  CoachActionType,
  type CoachActionDto,
  type CoachActionStatus as CoachActionStatusValue,
} from "@mentor/types";
import { useRouter } from "@/i18n/navigation";
import { decideCoachAction } from "@/lib/coach";
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
        router.push({
          pathname: "/study-session",
          query: {
            taskId: action.payload.planTaskId,
            ...(result.resultRefId
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
      <div className="flex max-w-[85%] items-center gap-2 rounded-[var(--radius-card)] bg-[var(--color-surface-container)] px-3 py-2 text-sm text-[var(--color-body-text)]">
        <CheckCircle2
          className="size-4 text-[var(--color-progress)]"
          aria-hidden
        />
        <span>
          {t(status === CoachActionStatus.COMPLETED ? "completed" : "accepted")}
        </span>
      </div>
    );
  }
  if (status === CoachActionStatus.CANCELLED) return null;

  return (
    <div className="flex max-w-[85%] flex-col gap-2 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white/80 p-3 shadow-[var(--shadow-card)]">
      <p className="flex items-center gap-2 text-sm font-semibold text-[var(--color-body-text)]">
        <Sparkles className="size-4 text-[var(--color-accent)]" aria-hidden />
        {action.label}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void decide("ACCEPT")}
          className="min-h-10 rounded-full bg-[var(--color-main)] px-4 text-sm font-semibold text-white disabled:opacity-50"
        >
          {t("approve")}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void decide("CANCEL")}
          className="min-h-10 rounded-full border px-4 text-sm font-semibold text-[var(--color-main)] disabled:opacity-50"
          style={{ borderColor: "var(--color-border)" }}
        >
          {t("dismiss")}
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
