"use client";

import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { PuhuImage } from "@/components/puhu-image";
import { useRouter } from "@/i18n/navigation";
import { useCloudTransition } from "@/lib/cloud-transition";
import { consumePendingInvite } from "@/lib/pending-invite";
import { onboardingDestination } from "../onboarding-flow";

export function CompleteStep({ onFinish }: { onFinish: () => void }) {
  const t = useTranslations("onboarding.complete");
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const { startCloudTransition } = useCloudTransition();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    onFinish();
    const destination = onboardingDestination(consumePendingInvite());
    const timer = window.setTimeout(() => {
      startCloudTransition(() => {
        // @ts-expect-error validated internal destination may be transported as a string.
        router.replace(destination);
      });
    }, reduceMotion ? 250 : 1_100);
    return () => window.clearTimeout(timer);
  }, [onFinish, reduceMotion, router, startCloudTransition]);

  return (
    <main className="flex min-h-dvh items-center justify-center px-5 text-center">
      <motion.div initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: reduceMotion ? 0.12 : 0.4, ease: "easeOut" }}>
        <PuhuImage variant="happy" size={220} priority />
        <h1 className="mt-6 text-2xl font-semibold text-[var(--color-main)] sm:text-3xl" style={{ fontFamily: "var(--font-heading)" }}>{t("title")}</h1>
      </motion.div>
    </main>
  );
}
