"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Lock, X } from "lucide-react";
import type { AchievementCollectionDto, AchievementView } from "@mentor/types";
import { AchievementArt } from "./achievement-art";

export function AchievementCollection({ collection }: { collection: AchievementCollectionDto }) {
  const t = useTranslations("achievements");
  const locale = useLocale();
  const [selected, setSelected] = useState<AchievementView | null>(null);

  if (collection.items.length === 0) {
    return <p className="px-4 py-12 text-center text-sm text-[var(--color-secondary)]">{t("public_empty")}</p>;
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 px-4 py-6 sm:grid-cols-3 lg:px-6">
        {collection.items.map((achievement) => {
          const earned = achievement.status === "EARNED";
          return (
            <button
              key={achievement.id}
              type="button"
              onClick={() => setSelected(achievement)}
              aria-label={earned ? achievement.title : t("locked_aria", { title: achievement.title })}
              className="group rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-left shadow-[var(--shadow-card)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            >
              <div className="relative mx-auto aspect-square w-full max-w-40">
                <AchievementArt
                  artKey={achievement.artKey}
                  alt={earned ? achievement.title : ""}
                  className={`size-full object-contain ${earned ? "" : "grayscale opacity-35"}`}
                />
                {!earned && (
                  <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
                    <span className="rounded-full bg-[var(--color-surface)] p-2 text-[var(--color-secondary)] shadow-[var(--shadow-card)]"><Lock size={18} /></span>
                  </span>
                )}
              </div>
              <p className="mt-2 line-clamp-2 text-center text-sm font-bold text-[var(--color-main)]">{achievement.title}</p>
              {earned && achievement.earnedAt && (
                <p className="mt-1 text-center text-xs text-[var(--color-secondary)]">
                  {t("earned_on", { date: new Intl.DateTimeFormat(locale).format(new Date(achievement.earnedAt)) })}
                </p>
              )}
              {achievement.progress && !earned && (
                <div className="mt-2">
                  <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-progress-track)]">
                    <span
                      className="block h-full rounded-full bg-[var(--color-accent)]"
                      style={{ width: `${Math.min(100, (achievement.progress.current / achievement.progress.target) * 100)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-center text-xs text-[var(--color-secondary)]">
                    {achievement.progress.current}/{achievement.progress.target}
                  </p>
                </div>
              )}
            </button>
          );
        })}
      </div>
      {selected && <AchievementDetail achievement={selected} locale={locale} onClose={() => setSelected(null)} />}
    </>
  );
}

function AchievementDetail({ achievement, locale, onClose }: { achievement: AchievementView; locale: string; onClose: () => void }) {
  const t = useTranslations("achievements");
  const earned = achievement.status === "EARNED";
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 sm:items-center" role="presentation" onMouseDown={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="achievement-detail-title"
        aria-describedby="achievement-detail-description"
        className="relative w-full max-w-md rounded-[var(--radius-card)] bg-[var(--color-surface)] p-6 text-center shadow-[var(--shadow-card)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button autoFocus type="button" onClick={onClose} aria-label={t("close")} className="absolute right-3 top-3 rounded-full p-2 text-[var(--color-secondary)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"><X size={20} /></button>
        <AchievementArt artKey={achievement.artKey} alt="" className={`mx-auto size-52 object-contain ${earned ? "" : "grayscale opacity-35"}`} />
        <p className="mt-2 text-xs font-bold uppercase tracking-wide text-[var(--color-accent)]">{earned ? t("earned") : t("locked")}</p>
        <h2 id="achievement-detail-title" className="mt-1 text-xl font-bold text-[var(--color-main)]">{achievement.title}</h2>
        <p id="achievement-detail-description" className="mt-2 text-sm leading-6 text-[var(--color-secondary)]">{achievement.description}</p>
        {earned && achievement.earnedAt && <p className="mt-3 text-xs text-[var(--color-secondary)]">{t("earned_on", { date: new Intl.DateTimeFormat(locale).format(new Date(achievement.earnedAt)) })}</p>}
      </section>
    </div>
  );
}
