"use client";

import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  const cardMotion = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const } },
      };

  const isInsufficientCoin = access.reason === "INSUFFICIENT_COIN";
  const isRateLimited = access.reason === "AI_RATE_LIMITED";

  const subtitle = isRateLimited
    ? "Bugünkü kazanılmış hak limitine ulaştın. Yarın tekrar deneyebilir veya Premium’a geçebilirsin."
    : isInsufficientCoin
      ? "Profilinden görevleri tamamla, arkadaş davet et veya Premium’a geçerek koçunla sohbet et."
      : "Premium ile koçunla sohbet et — ya da profilinden görevleri tamamla ve davet et.";

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-5 py-10">
      <motion.header
        {...(reduceMotion
          ? {}
          : {
              initial: { opacity: 0, y: 8 },
              animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const } },
            })}
      >
        <h1
          className="text-3xl font-bold"
          style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
        >
          Sınav Koçu
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--color-secondary)" }}>
          Premium ile veya kazanılmış hakla koçunla sohbet et.
        </p>
      </motion.header>
      <motion.div {...cardMotion}>
        <Card className="flex flex-col items-start gap-3">
          <Chip>{isRateLimited ? "Günlük limit" : isInsufficientCoin ? "Hak gerekli" : "Premium"}</Chip>
          <SectionHeading as="h2" subtitle={subtitle}>
            {isRateLimited
              ? "Bugünlük yeterli"
              : isInsufficientCoin
                ? "Koç için hak kazan"
                : "AI koç seninle"}
          </SectionHeading>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => router.push("/abonelik")}>Premium’a yükselt</Button>
            {isInsufficientCoin || access.reason === "PAYMENT_PREMIUM_REQUIRED" ? (
              <Button
                className="!bg-transparent !text-[var(--color-main)]"
                style={{ boxShadow: "none", border: "1px solid var(--color-border, #ccc)" }}
                onClick={() => router.push("/profil")}
              >
                Profilime git
              </Button>
            ) : null}
          </div>
        </Card>
      </motion.div>
    </main>
  );
}
