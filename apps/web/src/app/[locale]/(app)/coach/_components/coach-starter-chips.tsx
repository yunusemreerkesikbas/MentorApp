"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { TodayPanelResponse } from "@mentor/types";
import { coachingControllerGetToday } from "@mentor/api-client";
import { Link } from "@/i18n/navigation";
import { trackCoachEvent } from "@/lib/analytics";
import { resolveCoachNextActionHref } from "@/lib/coach-next-action-href";
import { useCoachAccess } from "./coach-access-shell";

const STARTER_KEYS = ["suggestion_1", "suggestion_2", "suggestion_3"] as const;

const chipBase =
  "inline-flex h-9 max-w-full shrink-0 cursor-pointer items-center rounded-full px-3.5 text-[12px] font-semibold whitespace-nowrap shadow-[var(--shadow-card)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none";

interface CoachStarterChipsProps {
  onSeed: (text: string) => void;
}

/**
 * Empty-landing chips: wrap into ~two centered rows (reference layout), next-action pinned when
 * linkable; static seeds fill the composer without auto-sending.
 */
export function CoachStarterChips({ onSeed }: CoachStarterChipsProps) {
  const tLanding = useTranslations("coach.landing");
  const tHub = useTranslations("coach.hub");
  const tChat = useTranslations("coach_chat");
  const access = useCoachAccess();
  const [today, setToday] = useState<TodayPanelResponse | null>(null);
  const impressionTracked = useRef(false);
  const landingViewTracked = useRef(false);

  useEffect(() => {
    let active = true;
    coachingControllerGetToday()
      .then((result) => {
        if (!active) return;
        const panel = result as unknown as TodayPanelResponse;
        setToday(panel);
      })
      .catch(() => {
        if (active) setToday(null);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!today || impressionTracked.current) return;
    impressionTracked.current = true;
    trackCoachEvent("coach_next_action_impression", {
      surface: "coach",
      next_action_kind: today.nextAction.kind,
    });
  }, [today]);

  useEffect(() => {
    if (!access || !today || landingViewTracked.current) return;
    landingViewTracked.current = true;
    trackCoachEvent("coach_hub_view", {
      access_mode: access.mode,
      next_action_kind: today.nextAction.kind,
    });
  }, [access, today]);

  const nextHref = today ? resolveCoachNextActionHref(today, "coach") : null;
  const nextLabel =
    today?.nextAction.kind === "START_TASK"
      ? tHub("next_action_start")
      : today?.nextAction.kind === "ADD_TASK"
        ? tHub("next_action_add")
        : null;

  return (
    <div
      className="mx-auto flex w-full max-w-md flex-wrap justify-center gap-2"
      role="group"
      aria-label={tLanding("chips_label")}
    >
      {nextHref && nextLabel ? (
        <Link
          href={nextHref}
          data-testid="coach-next-action-chip"
          onClick={() =>
            trackCoachEvent("coach_next_action_click", {
              surface: "coach",
              next_action_kind: today!.nextAction.kind,
            })
          }
          className={`${chipBase} bg-[var(--color-progress)] text-white`}
        >
          {nextLabel}
        </Link>
      ) : null}
      {STARTER_KEYS.map((key) => {
        const text = tChat(key);
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSeed(text)}
            className={`${chipBase} bg-[var(--color-surface)]`}
            style={{ color: "var(--color-main)" }}
          >
            {text}
          </button>
        );
      })}
    </div>
  );
}
