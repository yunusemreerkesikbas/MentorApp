"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { PuhuImage } from "@/components/puhu-image";
import { LEDGE, LEDGE_FILLED, PANEL_CARD } from "@/components/panel/panel-styles";
import { Link } from "@/i18n/navigation";

/**
 * No coach yet, or coaching switched off. The switch is a state, not a failure: the profile row
 * that leads here is always visible, so it gets the same calm card without the way in.
 */
export function MyCoachEmpty({ off }: { off: boolean }) {
  const t = useTranslations("mentorship");
  const titleId = useId();

  return (
    <section
      aria-labelledby={titleId}
      className={`${PANEL_CARD} flex max-w-2xl flex-col items-center gap-3.5 px-8 py-10 text-center`}
    >
      <PuhuImage variant="encouraging" size={120} />
      <h2 id={titleId} className="text-xl font-extrabold leading-snug text-[var(--color-main)]">
        {t(off ? "my_coach_off_title" : "my_coach_empty_title")}
      </h2>
      <p className="max-w-md text-body-sm font-semibold text-[var(--color-body)]">
        {t(off ? "my_coach_off_body" : "my_coach_empty_body")}
      </p>
      {off ? null : (
        <Link href="/coach-invitation" className={`${LEDGE} ${LEDGE_FILLED} mt-1.5`}>
          {t("my_coach_empty_cta")}
        </Link>
      )}
    </section>
  );
}
