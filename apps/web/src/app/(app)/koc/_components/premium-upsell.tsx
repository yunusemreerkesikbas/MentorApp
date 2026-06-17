"use client";

import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Button, Card, Chip, SectionHeading } from "@mentor/ui";

/** Free-user gate for /koc — premium upsell (§4 #4: no AI on free). CTA → /abonelik. */
export function PremiumUpsell() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  const cardMotion = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const } },
      };

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
          Premium ile koçunla sohbet et.
        </p>
      </motion.header>
      <motion.div {...cardMotion}>
        <Card className="flex flex-col items-start gap-3">
          <Chip>Premium</Chip>
          <SectionHeading as="h2" subtitle="Çalışma planı, motivasyon ve sınav kaygısı için yanında.">
            AI koç seninle
          </SectionHeading>
          <Button onClick={() => router.push("/abonelik")}>Premium’a yükselt</Button>
        </Card>
      </motion.div>
    </main>
  );
}
