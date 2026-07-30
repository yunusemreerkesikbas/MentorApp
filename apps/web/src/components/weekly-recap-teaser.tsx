"use client";

import { useEffect } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import type { WeeklyRecapStatus } from "@mentor/types";
import { Link } from "@/i18n/navigation";
import { trackWeeklyRecapEvent } from "@/lib/analytics";
import {
  buildWeeklyRecapTeaserHref,
  markWeeklyRecapOpened,
  WEEKLY_RECAP_FIGMA_ASSETS,
  type WeeklyRecapSource,
} from "@/lib/weekly-recap";

interface WeeklyRecapTeaserProps {
  period: { startDate: string; endDate: string };
  status: WeeklyRecapStatus | "UNKNOWN";
  source: WeeklyRecapSource;
  examId?: string;
  examType?: string;
  compact?: boolean;
  onOpen?: () => void;
}

export function WeeklyRecapTeaser({
  period,
  status,
  source,
  examId,
  examType,
  compact = false,
  onOpen,
}: WeeklyRecapTeaserProps) {
  const t = useTranslations("analysis.recap");
  const locale = useLocale();

  useEffect(() => {
    trackWeeklyRecapEvent("weekly_recap_teaser_impression", {
      surface: source,
      recap_status: status,
    });
  }, [source, status]);

  const handleOpen = () => {
    if (source === "dashboard") {
      markWeeklyRecapOpened(window.localStorage, period.startDate);
    }
    onOpen?.();
  };
  const periodLabel = t("teaser.period", {
    startDate: formatDate(period.startDate, locale),
    endDate: formatDate(period.endDate, locale),
  });

  return (
    <article
      data-testid={`weekly-recap-teaser-${source}`}
      className="overflow-hidden rounded-[var(--radius-card)] shadow-[var(--shadow-card)]"
    >
      <Link
        href={buildWeeklyRecapTeaserHref({
          source,
          examId,
          examType,
        })}
        onClick={handleOpen}
        className={`weekly-recap-theme relative block overflow-hidden bg-[var(--recap-coral)] text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-focus-ring)] ${
          compact ? "min-h-44" : "min-h-48 sm:min-h-52"
        }`}
        aria-label={`${t("teaser.title")}. ${t("teaser.message")}`}
      >
        <Image
          src={WEEKLY_RECAP_FIGMA_ASSETS.greenShape}
          alt=""
          width={430}
          height={370}
          aria-hidden
          draggable={false}
          className="pointer-events-none absolute -left-10 -top-28 w-52 rotate-[-10deg] sm:-left-6 sm:w-64"
        />
        <Image
          src={WEEKLY_RECAP_FIGMA_ASSETS.silverWiggle}
          alt=""
          width={540}
          height={780}
          aria-hidden
          draggable={false}
          className="pointer-events-none absolute -right-14 -top-28 w-44 rotate-[70deg] sm:-right-8 sm:w-52"
        />
        <Image
          src={WEEKLY_RECAP_FIGMA_ASSETS.redPixel}
          alt=""
          width={380}
          height={380}
          aria-hidden
          draggable={false}
          className="pointer-events-none absolute right-12 top-2 w-20 rotate-12 sm:right-24 sm:w-24"
        />

        <div
          className={`relative z-10 flex h-full flex-col justify-end ${
            compact ? "min-h-44 p-5 pt-24" : "min-h-48 p-5 pt-28 sm:min-h-52 sm:p-6 sm:pt-32"
          }`}
        >
          <h2 className="max-w-xl text-balance text-2xl font-black leading-none tracking-[-0.035em] sm:text-[28px]">
            {t("teaser.title")}
          </h2>
          <p className="mt-2 max-w-lg text-pretty text-sm font-semibold leading-5 text-black/75">
            {t("teaser.message")}
          </p>
          <span className="sr-only">
            {t(`teaser.status_${status}`)}. {periodLabel}
          </span>
        </div>
      </Link>
    </article>
  );
}

export function WeeklyRecapTeaserSkeleton() {
  return (
    <div
      className="mentor-skeleton-shimmer h-48 rounded-[var(--radius-card)]"
      aria-hidden
    />
  );
}

function formatDate(date: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
  }).format(new Date(`${date}T12:00:00.000Z`));
}
