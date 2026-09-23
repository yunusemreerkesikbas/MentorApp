import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { PANEL_CARD } from "@/components/panel/panel-styles";
import type { ArticleAnalyticsParams } from "@/lib/analytics";
import { ArticleCoachCta } from "./article-client-islands";

/** The page's one primary action (DESIGN §1 rule 1), said by Puhu (rule 4). */
export async function ArticleCoachCard({
  articleSlug,
  title,
  analyticsParams,
}: {
  articleSlug: string;
  title: string;
  analyticsParams: ArticleAnalyticsParams;
}) {
  const t = await getTranslations("article");
  return (
    <section aria-labelledby="coach-cta-title" className={`${PANEL_CARD} mt-4 flex flex-col gap-4`}>
      <h2 id="coach-cta-title" className="sr-only">
        {t("coach_title")}
      </h2>
      <div className="flex items-start gap-3 sm:gap-4">
        {/* ponytail: static twin of CompanionBubble; the client bubble would bring framer-motion to a public page */}
        <Image
          src="/mascot/puhu/puhu-encouraging.png"
          alt=""
          width={72}
          height={72}
          className="size-18 shrink-0 object-contain"
        />
        <p className="min-w-0 flex-1 rounded-[var(--play-radius)] bg-[var(--play-selected)] px-4 py-3 text-body-sm font-semibold text-[var(--color-body)]">
          {t("coach_bubble")}
        </p>
      </div>
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-4 sm:pl-22">
        <ArticleCoachCta
          articleSlug={articleSlug}
          coachSeed={t("coach_seed", { title })}
          authenticatedLabel={t("coach_cta")}
          anonymousLabel={t("coach_sign_in_cta")}
          analyticsParams={analyticsParams}
        />
        <p className="text-center text-caption font-semibold text-[var(--color-secondary)] sm:text-left">
          {t("coach_body")}
        </p>
      </div>
    </section>
  );
}
