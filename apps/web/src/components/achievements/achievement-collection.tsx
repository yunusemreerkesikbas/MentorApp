"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Info, Lock, X } from "lucide-react";
import type { AchievementCollectionDto, AchievementView } from "@mentor/types";
import { AchievementArt } from "./achievement-art";

export function AchievementCollection({
  collection,
}: {
  collection: AchievementCollectionDto;
}) {
  const t = useTranslations("achievements");
  const locale = useLocale();
  const [selected, setSelected] = useState<AchievementView | null>(null);
  const selectedTriggerRef = useRef<HTMLButtonElement | null>(null);

  const handleClose = () => {
    setSelected(null);
    window.requestAnimationFrame(() => selectedTriggerRef.current?.focus());
  };

  if (collection.items.length === 0) {
    return (
      <p className="px-4 py-12 text-center text-sm text-[var(--color-secondary)]">
        {t("public_empty")}
      </p>
    );
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
              onClick={(event) => {
                selectedTriggerRef.current = event.currentTarget;
                setSelected(achievement);
              }}
              aria-label={
                earned
                  ? achievement.title
                  : t("locked_aria", { title: achievement.title })
              }
              className="group relative rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-left shadow-[var(--shadow-card)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            >
              {!earned && (
                <span
                  data-achievement-info
                  aria-hidden="true"
                  className="absolute right-2 top-2 z-10 grid size-8 place-items-center rounded-full bg-[var(--color-surface)] text-[var(--color-secondary)] shadow-[var(--shadow-card)]"
                >
                  <Info size={16} />
                </span>
              )}
              <div className="relative mx-auto aspect-square w-full max-w-40">
                <AchievementArt
                  artKey={achievement.artKey}
                  alt={earned ? achievement.title : ""}
                  className={`size-full object-contain ${earned ? "" : "grayscale opacity-35"}`}
                />
                {!earned && (
                  <span
                    className="absolute inset-0 flex items-center justify-center"
                    aria-hidden="true"
                  >
                    <span className="rounded-full bg-[var(--color-surface)] p-2 text-[var(--color-secondary)] shadow-[var(--shadow-card)]">
                      <Lock size={18} />
                    </span>
                  </span>
                )}
              </div>
              <p className="mt-2 line-clamp-2 text-center text-sm font-bold text-[var(--color-main)]">
                {achievement.title}
              </p>
              {earned && achievement.earnedAt && (
                <p className="mt-1 text-center text-xs text-[var(--color-secondary)]">
                  {t("earned_on", {
                    date: new Intl.DateTimeFormat(locale).format(
                      new Date(achievement.earnedAt),
                    ),
                  })}
                </p>
              )}
            </button>
          );
        })}
      </div>
      {selected && (
        <AchievementDetail
          achievement={selected}
          locale={locale}
          onClose={handleClose}
        />
      )}
    </>
  );
}

function AchievementDetail({
  achievement,
  locale,
  onClose,
}: {
  achievement: AchievementView;
  locale: string;
  onClose: () => void;
}) {
  const t = useTranslations("achievements");
  const earned = achievement.status === "EARNED";
  const dialogRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") return;

      const focusableElements = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      const firstFocusableElement = focusableElements[0];
      const lastFocusableElement = focusableElements.at(-1);

      if (!firstFocusableElement || !lastFocusableElement) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }

      const isMovingBeforeDialog =
        event.shiftKey && document.activeElement === firstFocusableElement;
      const isMovingAfterDialog =
        !event.shiftKey && document.activeElement === lastFocusableElement;
      if (!isMovingBeforeDialog && !isMovingAfterDialog) return;

      event.preventDefault();
      (event.shiftKey ? lastFocusableElement : firstFocusableElement).focus();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [onClose]);

  return (
    <div
      data-achievement-detail-backdrop
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 sm:items-center"
      role="presentation"
      onMouseDown={onClose}
    >
      <section
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        aria-labelledby="achievement-detail-title"
        aria-describedby="achievement-detail-description"
        className="relative w-full max-w-md rounded-[var(--radius-card)] bg-[var(--color-surface)] p-6 text-center shadow-[var(--shadow-card)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          aria-label={t("close")}
          className="absolute right-3 top-3 grid size-11 place-items-center rounded-full text-[var(--color-secondary)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        >
          <X size={20} />
        </button>
        <AchievementArt
          artKey={achievement.artKey}
          alt=""
          className={`mx-auto size-52 object-contain ${earned ? "" : "grayscale opacity-35"}`}
        />
        <p className="mt-2 text-xs font-bold uppercase tracking-wide text-[var(--color-accent)]">
          {earned ? t("earned") : t("how_to_earn")}
        </p>
        <h2
          id="achievement-detail-title"
          className="mt-1 text-xl font-bold text-[var(--color-main)]"
        >
          {achievement.title}
        </h2>
        <p
          id="achievement-detail-description"
          className="mt-2 text-sm leading-6 text-[var(--color-secondary)]"
        >
          {earned ? achievement.description : achievement.unlockHint}
        </p>
        {!earned && achievement.progress && (
          <div className="mt-5 rounded-[var(--radius-card)] bg-[var(--color-soft)] p-4 text-left">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-bold text-[var(--color-main)]">
                {t("progress_label")}
              </span>
              <span className="tabular-nums text-[var(--color-secondary)]">
                {t("progress_days", {
                  current: achievement.progress.current,
                  target: achievement.progress.target,
                })}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-progress-track)]">
              <span
                className="block h-full rounded-full bg-[var(--color-accent)]"
                style={{
                  width: `${Math.min(
                    100,
                    (achievement.progress.current /
                      achievement.progress.target) *
                      100,
                  )}%`,
                }}
              />
            </div>
          </div>
        )}
        {earned && achievement.earnedAt && (
          <p className="mt-3 text-xs text-[var(--color-secondary)]">
            {t("earned_on", {
              date: new Intl.DateTimeFormat(locale).format(
                new Date(achievement.earnedAt),
              ),
            })}
          </p>
        )}
      </section>
    </div>
  );
}
