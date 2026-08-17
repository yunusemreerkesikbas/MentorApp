"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  communityCoachPlanHref,
  type CommunityCoachAttribution,
} from "@/lib/community-coach-bridge";

export type SuggestedTaskCardTask = {
  title: string;
  subject: string | null;
};

/**
 * Coach / session reflection plan-task suggestion → deep-links to /plan?add=1 prefill.
 * The task is saved only when the user confirms in the add sheet (AI never writes plan tasks).
 */
export function SuggestedTaskCard({
  task,
  className,
  communityContext,
}: {
  task: SuggestedTaskCardTask;
  /** Optional wrapper class (e.g. coach transcript left padding). */
  className?: string;
  /** Structural attribution only; no thread id or content enters analytics. */
  communityContext?: CommunityCoachAttribution;
}) {
  const translate = useTranslations("coach_chat");
  const href = communityContext
    ? communityCoachPlanHref(task, communityContext)
    : ({
        pathname: "/plan",
        query: {
          add: "1",
          title: task.title,
          ...(task.subject ? { subject: task.subject } : {}),
        },
      } as const);
  return (
    <div className={className ?? "flex justify-start"}>
      <div
        className="flex max-w-[85%] flex-col gap-2 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-surface)_50%,transparent)] px-4 py-3 text-left"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <span
          className="text-xs font-bold"
          style={{ color: "var(--color-secondary)" }}
        >
          {translate("suggested_task_label")}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="text-sm font-bold"
            style={{ color: "var(--color-main)" }}
          >
            {task.title}
          </span>
          {task.subject ? (
            <span
              className="rounded-full bg-[var(--color-surface)] px-2.5 py-0.5 text-xs font-bold"
              style={{ color: "var(--color-chip-text)" }}
            >
              {task.subject}
            </span>
          ) : null}
        </div>
        <Link
          href={href}
          className="inline-flex min-h-11 w-fit cursor-pointer items-center rounded-[var(--radius-card)] px-4 text-sm font-bold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
          style={{ backgroundColor: "var(--color-progress)" }}
        >
          {translate("add_to_plan")}
        </Link>
      </div>
    </div>
  );
}
