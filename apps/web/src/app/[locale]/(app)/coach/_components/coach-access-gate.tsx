"use client";
import { BookOpen, Check, Heart } from "lucide-react";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";
import { motion, useReducedMotion } from "framer-motion";
import type { CoachAccessDto } from "@mentor/types";
import { Button, Card, Chip, SectionHeading } from "@mentor/ui";
import { PuhuCoachBubble } from "@/components/puhu-coach-bubble";
import { safeInternalReturnTo } from "@/lib/community-coach-bridge";
import { usePremiumPaywall } from "@/lib/premium-paywall";

interface CoachAccessGateProps {
  access: CoachAccessDto;
}

const VALUE_ICONS = [Check, BookOpen, Heart] as const;

/**
 * /coach gate when the user cannot chat yet. Coin counts stay off the chat composer (§4 #3).
 */
export function CoachAccessGate({ access }: CoachAccessGateProps) {
  const t = useTranslations("coach.gate");
  const tCoach = useTranslations("coach");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const reduceMotion = useReducedMotion();
  const { openPaywall } = usePremiumPaywall();

  const cardMotion = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 12 },
        animate: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.3, ease: "easeOut" as const },
        },
      };

  const isInsufficientCoin = access.reason === "INSUFFICIENT_COIN";
  const isRateLimited = access.reason === "AI_RATE_LIMITED";

  const subtitle = isRateLimited
    ? t("rate_limited_subtitle")
    : isInsufficientCoin
      ? t("insufficient_coin_subtitle")
      : t("default_subtitle");

  const valueKeys = [
    "value_plan",
    "value_sources",
    "value_motivation",
  ] as const;
  const teaserKeys = [
    "teaser_study",
    "teaser_anxiety",
    "teaser_subject",
  ] as const;

  const bubbleMessage = isRateLimited
    ? t("bubble_rate_limited")
    : isInsufficientCoin
      ? t("bubble_insufficient")
      : t("bubble_default");
  const query = searchParams.toString();
  const returnTo = safeInternalReturnTo(`${pathname}${query ? `?${query}` : ""}`);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-5 py-10">
      <motion.header
        {...(reduceMotion
          ? {}
          : {
              initial: { opacity: 0, y: 8 },
              animate: {
                opacity: 1,
                y: 0,
                transition: { duration: 0.3, ease: "easeOut" as const },
              },
            })}
      >
        <h1
          className="text-3xl font-bold"
          style={{
            color: "var(--color-main)",
            fontFamily: "var(--font-heading)",
          }}
        >
          {tCoach("title")}
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--color-secondary)" }}>
          {t("header_subtitle")}
        </p>
      </motion.header>

      <motion.div
        className="flex w-full flex-col items-center gap-5"
        {...cardMotion}
      >
        <PuhuCoachBubble
          message={bubbleMessage}
          variant="encouraging"
          puhuSize={120}
          bounce
          dismissLabel={t("bubble_dismiss")}
          className="flex flex-col items-center"
        />
        <Card className="flex w-full flex-col items-start gap-3">
          <Chip>
            {isRateLimited
              ? t("chip_rate_limited")
              : isInsufficientCoin
                ? t("chip_insufficient")
                : t("chip_premium")}
          </Chip>
          <SectionHeading as="h2" subtitle={subtitle}>
            {isRateLimited
              ? t("heading_rate_limited")
              : isInsufficientCoin
                ? t("heading_insufficient")
                : t("heading_default")}
          </SectionHeading>

          <ul className="flex w-full flex-col gap-2">
            {valueKeys.map((key, i) => {
              const Icon = VALUE_ICONS[i];
              return (
                <li
                  key={key}
                  className="flex items-start gap-2 text-sm leading-relaxed"
                  style={{ color: "var(--color-body)" }}
                >
                  <Icon
                    className="mt-0.5 size-4 shrink-0"
                    style={{ color: "var(--color-progress)" }}
                    aria-hidden
                  />
                  {t(key)}
                </li>
              );
            })}
          </ul>

          {isInsufficientCoin ? (
            <Button onClick={() => router.push({ pathname: "/settings", query: { returnTo } })}>
              {t("go_profile")}
            </Button>
          ) : access.reason === "PAYMENT_PREMIUM_REQUIRED" ? (
            <Button onClick={() => openPaywall({ sourceFeature: "coach.chat" })}>
              {t("upgrade")}
            </Button>
          ) : null}
        </Card>
      </motion.div>

      <section className="px-1">
        <h3
          className="text-sm font-bold"
          style={{
            color: "var(--color-main)",
            fontFamily: "var(--font-heading)",
          }}
        >
          {t("teaser_title")}
        </h3>
        <ul className="mt-3 flex flex-col gap-2">
          {teaserKeys.map((key) => (
            <li
              key={key}
              className="text-sm leading-relaxed"
              style={{ color: "var(--color-secondary)" }}
            >
              {t(key)}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
