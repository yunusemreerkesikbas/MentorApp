"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { motion, useReducedMotion } from "framer-motion";
import type { CoachAccessDto } from "@mentor/types";
import { Button, Card, Chip, SectionHeading } from "@mentor/ui";

interface CoachAccessGateProps {
  access: CoachAccessDto;
}

/**
 * /koc gate when the user cannot chat yet. Coin counts stay off the chat composer (§4 #3).
 */
export function CoachAccessGate({ access }: CoachAccessGateProps) {
  const t = useTranslations("coach.gate");
  const tCoach = useTranslations("coach");
  const router = useRouter();
  const reduceMotion = useReducedMotion();

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
      <motion.div {...cardMotion}>
        <Card className="flex flex-col items-start gap-3">
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
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => router.push("/abonelik")}>
              {t("upgrade")}
            </Button>
            {isInsufficientCoin ||
            access.reason === "PAYMENT_PREMIUM_REQUIRED" ? (
              <Button variant="secondary" onClick={() => router.push("/profil")}>
                {t("go_profile")}
              </Button>
            ) : null}
          </div>
        </Card>
      </motion.div>
    </main>
  );
}
