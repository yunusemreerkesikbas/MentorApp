"use client";

import { useId } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import type { MentorshipDataScopeKey } from "@mentor/types";
import { ScopeNeverList, ScopeRow } from "@/components/mentorship/scope-rows";
import { PANEL_CARD, PANEL_CARD_TITLE } from "@/components/panel/panel-styles";

const COLUMN_TITLE =
  "mb-1 flex items-center gap-2 text-body-sm font-extrabold text-[var(--color-main)]";

/**
 * "Onaylarsan": what the coach will and will not see, side by side, between the coach and the
 * button. KVKK consent has to be informed, so the list is on the page, not behind a link.
 * `scope` comes from the API, so these lines cannot drift from what the server sends a coach.
 */
export function InvitationScopeCard({ scope }: { scope: readonly MentorshipDataScopeKey[] }) {
  const t = useTranslations("mentorship");
  const titleId = useId();

  return (
    <section aria-labelledby={titleId} className={`${PANEL_CARD} flex flex-col gap-4 sm:p-6`}>
      <h2 id={titleId} className={PANEL_CARD_TITLE}>
        {t("invitation_scope_title")}
      </h2>
      <div className="grid gap-4.5 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] md:gap-7">
        <div>
          <h3 className={COLUMN_TITLE}>
            <Eye aria-hidden className="size-4.5" strokeWidth={1.75} />
            {t("invitation_scope_sees")}
          </h3>
          <ul>
            {scope.map((key) => (
              <ScopeRow key={key} scopeKey={key} title={t(`scope_label_${key}`)}>
                {t(`scope_${key}`)}
              </ScopeRow>
            ))}
          </ul>
        </div>
        <div>
          <h3 className={COLUMN_TITLE}>
            <EyeOff aria-hidden className="size-4.5" strokeWidth={1.75} />
            {t("invitation_scope_never")}
          </h3>
          <ScopeNeverList />
          <p className="mt-2 text-caption font-semibold text-[var(--color-secondary)]">
            {t("scope_never_keep")}
          </p>
        </div>
      </div>
      {/* What the coach can WRITE, not see, so it sits under both columns, not inside one. */}
      <p className="border-t border-[var(--play-line)] pt-3 text-caption font-semibold text-[var(--color-secondary)]">
        {t("scope_coach_writes")}
      </p>
    </section>
  );
}
