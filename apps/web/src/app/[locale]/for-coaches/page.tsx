import "@fontsource-variable/caveat/wght.css";
import "./_components/coaches.css";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { setRequestLocale } from "@/i18n/locale";
import { getPathname } from "@/i18n/navigation";
import { fetchCoachSignupOpen } from "@/lib/coach-signup";
import { siteUrl } from "@/lib/forum-public";
import { LandingFooter } from "../_components/landing/landing-footer";
import { LandingNav } from "../_components/landing/landing-nav";
import { PaperFaq } from "../_components/landing/landing-paper";
import { CoachesHero } from "./_components/coaches-hero";
import { CoachesFinal, CoachesRound } from "./_components/coaches-round";

type PageProps = { params: Promise<{ locale: string }> };

const FAQ = [1, 2, 3, 4, 5] as const;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("coaches");
  return {
    title: t("meta_title"),
    description: t("meta_description"),
    // Turkish is canonical, as on the landing; the English copy stays out of the index.
    alternates: { canonical: `${siteUrl()}${getPathname({ locale: "tr", href: "/for-coaches" })}` },
    robots: locale === "en" ? { index: false, follow: true } : undefined,
  };
}

/**
 * "Koçlar için" (spec: docs/superpowers/specs/2026-10-27-landing-isikli-sehir-design.md): a coach's
 * morning round in the landing's world. Public and indexable; the coach CTAs show only while coach
 * signup is open, the way the landing's coach band does.
 */
export default async function ForCoachesPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [signupOpen, t, nonce] = await Promise.all([
    fetchCoachSignupOpen(),
    getTranslations("coaches"),
    headers().then((h) => h.get("x-nonce") ?? undefined),
  ]);

  return (
    <div className="landing-city-theme landing-day kc-root min-h-screen">
      <LandingNav variant="coaches" coachSignupOpen={signupOpen} />
      <main>
        <CoachesHero signupOpen={signupOpen} />
        <div className="landing-paper kc-after">
          <CoachesRound />
          <PaperFaq
            pill={t("faq.pill")}
            title={t("faq.title")}
            items={FAQ.map((i) => ({ q: t(`faq.q${i}`), a: t(`faq.a${i}`) }))}
            nonce={nonce}
          />
          <CoachesFinal signupOpen={signupOpen} />
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
