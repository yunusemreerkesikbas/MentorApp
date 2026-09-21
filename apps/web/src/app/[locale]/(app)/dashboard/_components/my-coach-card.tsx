"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronRight } from "lucide-react";
import type { MyCoachDto } from "@mentor/types";
import { Link } from "@/i18n/navigation";
import { fetchMyCoach } from "@/lib/mentorship";
import { PANEL_CARD, PANEL_TEXT_LINK } from "./panel-styles";

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase("tr") ?? "")
    .join("");
}

/**
 * "Koçun": for a student with a human coach — the coach's name, the standing note they left, and
 * the way to their page. Best-effort and silent: no coach, mentorship off or an error all mean no
 * card. The hero already marks which of today's steps came from the coach.
 */
export function MyCoachCard() {
  const t = useTranslations("panel");
  const [coach, setCoach] = useState<MyCoachDto | null>(null);

  useEffect(() => {
    let active = true;
    fetchMyCoach()
      .then((next) => {
        if (active) setCoach(next?.status === "ACTIVE" ? next : null);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  if (!coach) return null;

  return (
    <section
      className={`${PANEL_CARD} flex flex-col gap-3`}
      aria-labelledby="my-coach-card-title"
      data-testid="panel-my-coach"
    >
      <div className="flex items-center gap-3">
        <span
          className="grid size-11 shrink-0 place-items-center rounded-full bg-[var(--coach-accent)] text-body-sm font-black text-[var(--color-bg)]"
          aria-hidden
        >
          {initials(coach.coachDisplayName)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-caption font-bold text-[var(--color-secondary)]">
            {t("my_coach_eyebrow")}
          </p>
          <h2
            id="my-coach-card-title"
            className="truncate text-base font-extrabold text-[var(--color-main)]"
          >
            {coach.coachDisplayName}
          </h2>
        </div>
        <Link href="/my-coach" className={PANEL_TEXT_LINK}>
          {t("my_coach_open")}
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      </div>
      {coach.coachNote ? (
        <blockquote className="rounded-[var(--radius-card)] bg-[var(--coach-accent-soft)] px-3.5 py-2.5 text-sm leading-6 text-[var(--coach-accent-ink)]">
          {coach.coachNote.body}
        </blockquote>
      ) : null}
    </section>
  );
}
