"use client";

import { useState } from "react";
import type { PlanTaskDto, PlanTaskOriginDto } from "@mentor/types";
import Check from "lucide-react/dist/esm/icons/check.mjs";
import MessageCircle from "lucide-react/dist/esm/icons/message-circle.mjs";
import ArrowRight from "lucide-react/dist/esm/icons/arrow-right.mjs";
import X from "lucide-react/dist/esm/icons/x.mjs";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { trackCoachEvent } from "@/lib/analytics";
import {
  communityTaskSourceHref,
  communityTaskSourceLabelKey,
} from "@/lib/community-coach-bridge";
import { getForumCoachBridge } from "@/lib/forum";
import { buildStudySessionHrefFromPlanTask } from "@/lib/plan-study-session-link";
import { PlanTaskMenu } from "./plan-task-menu";

export function PlanTaskRow({
  task,
  busy,
  readOnly,
  onToggle,
  onEdit,
  onDelete,
  dense,
  showCompletionPrompt,
  onDismissCompletionPrompt,
}: {
  task: PlanTaskDto;
  busy?: boolean;
  readOnly?: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  dense?: boolean;
  showCompletionPrompt?: boolean;
  onDismissCompletionPrompt?: () => void;
}) {
  const t = useTranslations("plan");
  const router = useRouter();
  const done = task.status === "DONE";
  const communityOrigin =
    task.origin?.type === "COMMUNITY_COACH" ? task.origin : null;
  const [sourceState, setSourceState] = useState<
    "ready" | "checking" | "unavailable"
  >("ready");

  async function openCommunitySource(origin: PlanTaskOriginDto) {
    if (sourceState !== "ready") return;
    if (done) {
      trackCoachEvent("coach_community_completion_return_click", {
        intent: origin.intent,
        zone_type: origin.zoneType,
      });
    }
    setSourceState("checking");
    try {
      await getForumCoachBridge(origin.threadId);
      router.push(communityTaskSourceHref(origin, task.status));
    } catch {
      setSourceState("unavailable");
    }
  }

  return (
    <div
      className="border-b last:border-b-0"
      style={{
        borderColor: "color-mix(in srgb, var(--color-main) 10%, transparent)",
      }}
    >
      <div
        className={`group flex items-center gap-2 ${
          dense
            ? "min-h-[48px] py-2.5 max-lg:min-h-[44px] max-lg:gap-1.5 max-lg:py-1.5"
            : "min-h-[56px] py-3"
        }`}
      >
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={task.title}
        disabled={busy || readOnly}
        onClick={onToggle}
        className={`flex shrink-0 items-center justify-center rounded-[var(--radius-card)] focus-visible:outline-none focus-visible:ring-2 disabled:opacity-40 motion-reduce:transition-none ${
          dense
            ? "min-h-11 min-w-11"
            : "min-h-11 min-w-11"
        }`}
      >
        <span
          aria-hidden
          className={`flex items-center justify-center rounded-[6px] border-2 transition-colors motion-reduce:transition-none ${
            dense ? "h-6 w-6 max-lg:h-5 max-lg:w-5" : "h-6 w-6"
          }`}
          style={{
            borderColor: done ? "var(--color-progress)" : "var(--color-secondary)",
            backgroundColor: done ? "var(--color-progress)" : "transparent",
          }}
        >
          {done ? (
            <Check
              size={dense ? 12 : 14}
              color="#fff"
              strokeWidth={3}
              aria-hidden
            />
          ) : null}
        </span>
      </button>

      <div className="min-w-0 flex-1">
        <span
          className={`block ${dense ? "text-base max-lg:text-sm" : "text-base"} ${done ? "line-through opacity-70" : "font-medium"}`}
          style={{
            color: done ? "var(--color-secondary)" : "var(--color-body)",
          }}
        >
          {task.title}
        </span>
        <div
          className={`flex flex-wrap items-center gap-2 ${dense ? "mt-1 max-lg:mt-0.5 max-lg:gap-1.5" : "mt-1"}`}
        >
          {task.subject ? (
            <span
              className={`font-bold uppercase tracking-wide ${dense ? "text-[10px] max-lg:text-[9px]" : "text-[10px]"}`}
              style={{
                color: "var(--color-chip-text)",
                fontFamily: "var(--font-body)",
              }}
            >
              {task.subject}
            </span>
          ) : null}
          {!done && !readOnly ? (
            <Link
              href={buildStudySessionHrefFromPlanTask(task)}
              className={`font-bold transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 ${dense ? "text-xs max-lg:text-[11px]" : "text-xs"}`}
              style={{ color: "var(--color-progress)" }}
            >
              {t("start_session")} →
            </Link>
          ) : null}
          {communityOrigin ? (
            <button
              type="button"
              disabled={sourceState !== "ready"}
              onClick={() => void openCommunitySource(communityOrigin)}
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-2.5 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 disabled:cursor-default ${
                sourceState === "unavailable"
                  ? "text-[#7b808a]"
                  : "text-[var(--community-blue-ink)] hover:bg-[color-mix(in_srgb,var(--community-blue)_16%,white)]"
              }`}
              aria-label={
                sourceState === "checking"
                  ? t("community_task_source_checking")
                  : sourceState === "unavailable"
                    ? t("community_task_source_unavailable")
                    : t(communityTaskSourceLabelKey(task.status))
              }
            >
              <MessageCircle size={15} strokeWidth={2.2} aria-hidden />
              <span>
                {sourceState === "checking"
                  ? t("community_task_source_checking")
                  : sourceState === "unavailable"
                    ? t("community_task_source_unavailable")
                    : t(communityTaskSourceLabelKey(task.status))}
              </span>
            </button>
          ) : null}
        </div>
      </div>

      {!readOnly ? (
        <PlanTaskMenu
          taskTitle={task.title}
          disabled={busy}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ) : null}
      </div>

      {showCompletionPrompt && communityOrigin ? (
        <div
          className="mb-3 ml-11 flex flex-col gap-3 rounded-[12px] border border-[color-mix(in_srgb,var(--community-blue)_42%,white)] bg-[color-mix(in_srgb,var(--community-blue)_12%,white)] p-3 sm:flex-row sm:items-center"
          role="status"
        >
          <MessageCircle
            size={20}
            strokeWidth={2.2}
            className="shrink-0 text-[var(--community-blue-ink)]"
            aria-hidden
          />
          <p className="min-w-0 flex-1 text-sm font-semibold leading-5 text-[#343945]">
            {t("community_completion_message")}
          </p>
          <button
            type="button"
            disabled={sourceState !== "ready"}
            onClick={() => void openCommunitySource(communityOrigin)}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-[10px] bg-[var(--community-blue)] px-4 text-sm font-extrabold text-[#111318] hover:bg-[var(--community-blue-hover)] hover:text-white focus-visible:outline-none focus-visible:ring-2 disabled:opacity-60"
          >
            {sourceState === "unavailable"
              ? t("community_task_source_unavailable")
              : t("community_completion_cta")}
            <ArrowRight size={16} aria-hidden />
          </button>
          <button
            type="button"
            onClick={onDismissCompletionPrompt}
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full text-[#6f7580] hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2"
            aria-label={t("community_completion_dismiss")}
          >
            <X size={17} aria-hidden />
          </button>
        </div>
      ) : null}
    </div>
  );
}
