import { setRequestLocale } from "@/i18n/locale";
import type { Metadata } from "next";
import { Suspense } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { pickMessages, ROUTE_MESSAGE_SCOPES } from "@/i18n/scoped-messages";
import { siteUrl } from "@/lib/forum-public";
import { cityStageContent } from "./_components/landing/city-panels";
import { CityStage } from "./_components/landing/city-stage";
import { LandingAfter } from "./_components/landing/landing-after";
import { LandingAuthRedirect } from "./_components/landing/landing-auth-redirect";
import { LandingFooter } from "./_components/landing/landing-footer";
import { LandingNav } from "./_components/landing/landing-nav";
import { LandingWaitlist } from "./_components/landing/landing-waitlist";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  // One canonical, the Turkish page, as the blog does: the app publishes no hreflang, so the
  // English copy stays out of the index. Title and description come from the layout.
  return {
    alternates: { canonical: `${siteUrl()}/` },
    robots: locale === "en" ? { index: false, follow: true } : undefined,
  };
}

/**
 * The public landing ("Işıklı şehir", docs/superpowers/specs/2026-10-27-landing-isikli-sehir-design.md).
 * Server-rendered and indexable. The welcome slider moved to `/hosgeldin`, behind "Ücretsiz başla".
 */
export default async function Home({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [stage, messages] = await Promise.all([cityStageContent(), getMessages()]);
  return (
    // "Ücretsiz başla" may open the waitlist card, a client island that needs its own copy.
    <NextIntlClientProvider messages={pickMessages(messages, ROUTE_MESSAGE_SCOPES.landing)}>
      <div className="landing-city-theme min-h-screen bg-[var(--landing-night-bottom)]">
        <LandingAuthRedirect />
        <LandingNav />
        <main>
          <CityStage {...stage} />
          <LandingAfter />
        </main>
        <LandingFooter />
        <Suspense fallback={null}>
          <LandingWaitlist />
        </Suspense>
      </div>
    </NextIntlClientProvider>
  );
}
