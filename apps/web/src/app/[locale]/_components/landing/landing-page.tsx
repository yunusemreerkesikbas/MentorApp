"use client";

import type { InfoArticleSummaryDto } from "@mentor/types";
import { motion, useReducedMotion } from "framer-motion";
import { staggerItemVariants, staggerListVariants } from "@/lib/stagger-motion";
import { LandingCtaBand, LandingFooterSection } from "./landing-cta";
import { LandingEditorial } from "./landing-editorial";
import { LandingFeatures } from "./landing-features";
import { LandingHeader } from "./landing-header";
import { LandingHero } from "./landing-hero";

/** Public marketing landing — motion matches Profil/Panel rhythm. */
export function LandingPage({
  articles,
}: {
  articles: InfoArticleSummaryDto[];
}) {
  const reduceMotion = useReducedMotion();

  const mainMotion = reduceMotion
    ? {}
    : {
        initial: "hidden" as const,
        animate: "show" as const,
        variants: staggerListVariants,
      };

  return (
    <div className="relative min-h-screen">
      <LandingHeader />
      <motion.main
        className="mx-auto w-full max-w-6xl px-5 lg:px-8"
        {...mainMotion}
      >
        <motion.div variants={reduceMotion ? undefined : staggerItemVariants}>
          <LandingHero />
        </motion.div>
        <motion.div variants={reduceMotion ? undefined : staggerItemVariants}>
          <LandingFeatures />
        </motion.div>
        {articles.length > 0 ? (
          <motion.div variants={reduceMotion ? undefined : staggerItemVariants}>
            <LandingEditorial articles={articles} />
          </motion.div>
        ) : null}
        <motion.div variants={reduceMotion ? undefined : staggerItemVariants}>
          <LandingCtaBand />
        </motion.div>
      </motion.main>
      <LandingFooterSection />
    </div>
  );
}
