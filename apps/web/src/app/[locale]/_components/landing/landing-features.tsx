"use client";

import { useTranslations } from "next-intl";
import { Card, SectionHeading } from "@mentor/ui";

const ACCENTS = ["#D6DBFD", "#DDACE5", "#BDEBFF"] as const;

function FeatureIcon({ accent }: { accent: string }) {
  return (
    <span
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius-card)]"
      style={{ backgroundColor: accent }}
      aria-hidden
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--color-main)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2l2 4 4 1-3 3 1 4-4-2-4 2 1-3-3 1-4-4z" />
      </svg>
    </span>
  );
}

/** Three product pillars — Nuton card stack on mobile, grid on desktop. */
export function LandingFeatures() {
  const t = useTranslations("landing.features");

  const features = [
    {
      key: "ai_coach" as const,
      title: t("ai_coach_title"),
      description: t("ai_coach_desc"),
      accent: ACCENTS[0],
    },
    {
      key: "ritual" as const,
      title: t("ritual_title"),
      description: t("ritual_desc"),
      accent: ACCENTS[1],
    },
    {
      key: "knowledge" as const,
      title: t("knowledge_title"),
      description: t("knowledge_desc"),
      accent: ACCENTS[2],
    },
  ];

  return (
    <section className="py-10 lg:py-14">
      <SectionHeading subtitle={t("subtitle")}>{t("heading")}</SectionHeading>
      <ul className="mt-6 grid gap-4 lg:grid-cols-3 lg:gap-6">
        {features.map((f) => (
          <li key={f.key}>
            <Card className="flex flex-col gap-3">
              <FeatureIcon accent={f.accent} />
              <h3
                className="text-base font-bold"
                style={{
                  color: "var(--color-main)",
                  fontFamily: "var(--font-heading)",
                }}
              >
                {f.title}
              </h3>
              <p
                className="text-sm leading-relaxed"
                style={{ color: "var(--color-secondary)" }}
              >
                {f.description}
              </p>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
