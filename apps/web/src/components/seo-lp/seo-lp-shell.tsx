import "@fontsource-variable/caveat/wght.css";
import "./seo-paper.css";
import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { LandingFooter } from "@/app/[locale]/_components/landing/landing-footer";
import { LandingNav } from "@/app/[locale]/_components/landing/landing-nav";
import { type FaqItem, PaperFaq } from "@/app/[locale]/_components/landing/landing-paper";
import { pickMessages, ROUTE_MESSAGE_SCOPES } from "@/i18n/scoped-messages";
import { jsonLdHtml } from "@/lib/json-ld";
import { SeoFlutterRoot } from "./seo-flutter-root";

/**
 * The frame every SEO page shares: the landing's day theme and nav, the paper `<main>`, the page's
 * own sections (children), the FAQ (with its FAQPage JSON-LD), the page's closing and the footer.
 * The page's WebApplication JSON-LD ships only on the canonical Turkish page.
 */
export async function SeoLpShell({
  locale,
  nonce,
  jsonLd,
  faq,
  closing,
  children,
}: {
  locale: string;
  nonce?: string;
  jsonLd: unknown;
  faq: { pill: string; title: string; items: FaqItem[] };
  closing: ReactNode;
  children: ReactNode;
}) {
  const messages = await getMessages();
  return (
    <NextIntlClientProvider messages={pickMessages(messages, ROUTE_MESSAGE_SCOPES.landing)}>
      <div className="landing-city-theme landing-day min-h-screen">
        {locale === "tr" ? (
          <script nonce={nonce} type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLd) }} />
        ) : null}
        <LandingNav variant="seo" />
        <main className="landing-paper seo-lp">
          <SeoFlutterRoot>
            {children}
            <PaperFaq pill={faq.pill} title={faq.title} items={faq.items} nonce={nonce} />
            {closing}
          </SeoFlutterRoot>
        </main>
        <LandingFooter />
      </div>
    </NextIntlClientProvider>
  );
}
