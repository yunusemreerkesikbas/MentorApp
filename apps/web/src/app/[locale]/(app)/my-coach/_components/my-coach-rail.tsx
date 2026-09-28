"use client";

import { useId } from "react";
import { Unlink } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { MentorshipDataScopeKey, MentorshipSharedDataDto } from "@mentor/types";
import { ScopeNeverList, ScopeRow } from "@/components/mentorship/scope-rows";
import { PANEL_CARD, PANEL_CARD_TITLE } from "@/components/panel/panel-styles";
import { ProgressLine } from "@/components/panel/progress-line";
import { scopeValue } from "./scope-values";

/**
 * The transparency half of Koçum: what the coach sees, line by line with the figure actually
 * travelling (APP-073's scope mirror, pointed at the student), and the way to stop it right under
 * the data it stops. `values` is null while the mirror is missing; each line then keeps the plain
 * words of the consent instead of a row of zeroes.
 */
export function MyCoachRail({
  scope,
  values,
  busy,
  onEnd,
}: {
  scope: readonly MentorshipDataScopeKey[];
  values: MentorshipSharedDataDto | null;
  busy: boolean;
  onEnd: () => void;
}) {
  const t = useTranslations("mentorship");
  const locale = useLocale();
  const seesId = useId();
  const neverId = useId();

  return (
    <aside aria-label={t("my_coach_rail_label")} className="flex min-w-0 flex-col gap-5">
      <section aria-labelledby={seesId} className={`${PANEL_CARD} flex flex-col`}>
        <h2 id={seesId} className={`${PANEL_CARD_TITLE} mb-2`}>
          {t("scope_title")}
        </h2>
        <ul>
          {scope.map((key) => {
            const value = values ? scopeValue(key, values, t, locale) : null;
            const rate = key === "PLAN_TASK_TITLES" ? (values?.planTasks?.planCompletionRate7d ?? null) : null;
            return (
              <ScopeRow key={key} scopeKey={key} title={t(`scope_label_${key}`)}>
                {value ?? t(`scope_${key}`)}
                {/* The rate is already in the sentence; the line only draws it. */}
                {rate !== null ? (
                  <div aria-hidden className="mt-1.5">
                    <ProgressLine label="" value={Math.round(rate * 100)} max={100} />
                  </div>
                ) : null}
              </ScopeRow>
            );
          })}
        </ul>
        <p className="border-t border-[var(--play-line)] pt-3 text-caption font-semibold text-[var(--color-secondary)]">
          {t("scope_coach_writes")}
        </p>
        <div className="mt-3 flex flex-col gap-0.5 border-t border-[var(--play-line)] pt-3">
          <p className="text-caption font-semibold text-[var(--color-secondary)]">{t("my_coach_end_hint")}</p>
          <button
            type="button"
            disabled={busy}
            onClick={onEnd}
            className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 self-start text-body-sm font-extrabold text-[var(--color-danger)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:cursor-wait disabled:opacity-60"
          >
            <Unlink aria-hidden className="size-4.5" strokeWidth={1.75} />
            {t("my_coach_end")}
          </button>
        </div>
      </section>

      <section aria-labelledby={neverId} className={`${PANEL_CARD} flex flex-col gap-2`}>
        <h2 id={neverId} className={PANEL_CARD_TITLE}>
          {t("scope_never_title")}
        </h2>
        <ScopeNeverList />
        <p className="text-caption font-semibold text-[var(--color-secondary)]">{t("scope_never_keep")}</p>
      </section>
    </aside>
  );
}
