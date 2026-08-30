"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { InfoArticleCoverImageDto } from "@mentor/types";

export function ArticleGallerySlider({
  images,
}: {
  images: InfoArticleCoverImageDto[];
}) {
  const t = useTranslations("article");
  const [index, setIndex] = useState(0);
  if (images.length === 0) return null;
  const current = images[index]!;
  const canSlide = images.length > 1;

  return (
    <div className="relative overflow-hidden rounded-[var(--radius-card)]">
      {/* eslint-disable-next-line @next/next/no-img-element -- editorial slider with known dimensions */}
      <img
        src={current.url}
        alt={current.alt}
        width={current.width}
        height={current.height}
        className="h-auto w-full object-cover"
      />
      {canSlide ? (
        <>
          <button
            type="button"
            aria-label={t("gallery_prev")}
            onClick={() => setIndex((value) => (value === 0 ? images.length - 1 : value - 1))}
            className="absolute left-3 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--color-main)_55%,transparent)] text-[var(--color-btn-label)] focus-visible:outline-none focus-visible:ring-2"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label={t("gallery_next")}
            onClick={() => setIndex((value) => (value === images.length - 1 ? 0 : value + 1))}
            className="absolute right-3 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--color-main)_55%,transparent)] text-[var(--color-btn-label)] focus-visible:outline-none focus-visible:ring-2"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <p className="sr-only">{t("gallery_slide", { current: index + 1, total: images.length })}</p>
        </>
      ) : null}
    </div>
  );
}
