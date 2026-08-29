"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Info, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type {
  CommunityLevelView,
  JourneyLevelChapterId,
  JourneyLevelKey,
} from "@mentor/types";

import {
  JOURNEY_LEVEL_CATALOG,
  JOURNEY_LEVEL_CHAPTERS,
  getJourneyLevelCatalogItem,
} from "./journey-level-catalog";
import { JourneyLevelMedallion } from "./journey-level-medallion";
import { JourneyLevelProgressBar } from "./journey-level-progress";

type LevelCopyKey = `levels.${JourneyLevelKey}.${"name" | "story"}`;
type ChapterCopyKey = `chapters.${JourneyLevelChapterId}.name`;

interface JourneyLevelGuideProps {
  level: CommunityLevelView;
  isOwner: boolean;
}

export function JourneyLevelGuide({ level, isOwner }: JourneyLevelGuideProps) {
  const t = useTranslations("journey_levels");
  const [open, setOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState<JourneyLevelKey>(level.key);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const handleOpen = () => {
    setSelectedKey(level.key);
    setOpen(true);
  };
  const handleClose = useCallback(() => setOpen(false), []);
  const handleExitComplete = () => {
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOpen}
        aria-label={t("guide_open")}
        className="absolute right-0 top-0 grid size-11 place-items-center rounded-full text-[var(--color-secondary)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-main)_8%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
      >
        <Info size={19} aria-hidden="true" />
      </button>
      {typeof document !== "undefined"
        ? createPortal(
            <AnimatePresence onExitComplete={handleExitComplete}>
              {open ? (
                <JourneyLevelGuideDialog
                  key="journey-level-guide"
                  level={level}
                  isOwner={isOwner}
                  selectedKey={selectedKey}
                  onSelect={setSelectedKey}
                  onClose={handleClose}
                />
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}
    </>
  );
}

function JourneyLevelGuideDialog({
  level,
  isOwner,
  selectedKey,
  onSelect,
  onClose,
}: {
  level: CommunityLevelView;
  isOwner: boolean;
  selectedKey: JourneyLevelKey;
  onSelect: (key: JourneyLevelKey) => void;
  onClose: () => void;
}) {
  const t = useTranslations("journey_levels");
  const locale = useLocale();
  const reduceMotion = Boolean(useReducedMotion());
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const selectedLevel = getJourneyLevelCatalogItem(selectedKey)!;
  const selectedName = t(`levels.${selectedKey}.name` as LevelCopyKey);
  const selectedStory = t(`levels.${selectedKey}.story` as LevelCopyKey);

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [onClose]);

  return (
    <motion.div
      data-journey-level-guide-backdrop
      role="presentation"
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/45 sm:items-center sm:p-4"
      onMouseDown={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduceMotion ? 0.1 : 0.2 }}
    >
      <motion.section
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="relative h-dvh w-full overflow-y-auto bg-[var(--color-surface)] px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-[max(20px,env(safe-area-inset-top))] shadow-[var(--shadow-card)] sm:h-auto sm:max-h-[90dvh] sm:max-w-3xl sm:rounded-[var(--radius-card)] sm:px-6 sm:pb-6 sm:pt-6"
        onMouseDown={(event) => event.stopPropagation()}
        initial={{ opacity: 0, y: reduceMotion ? 0 : 20, scale: reduceMotion ? 1 : 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: reduceMotion ? 0 : 12, scale: reduceMotion ? 1 : 0.985 }}
        transition={{ duration: reduceMotion ? 0.1 : 0.2, ease: [0.22, 1, 0.36, 1] }}
      >
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          aria-label={t("close")}
          className="absolute right-3 top-[max(12px,env(safe-area-inset-top))] grid size-11 place-items-center rounded-full text-[var(--color-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] sm:top-3"
        >
          <X size={20} aria-hidden="true" />
        </button>

        <div className="pr-12">
          <h2 id={titleId} className="text-xl font-bold text-[var(--color-main)]">
            {t("guide_title")}
          </h2>
          <p id={descriptionId} className="mt-1 text-sm leading-6 text-[var(--color-secondary)]">
            {t("guide_description")}
          </p>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div className="space-y-4">
            {JOURNEY_LEVEL_CHAPTERS.map((chapter) => (
              <section key={chapter.id}>
                <h3 className="text-sm font-bold text-[var(--color-main)]">
                  {t(`chapters.${chapter.id}.name` as ChapterCopyKey)}
                </h3>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {JOURNEY_LEVEL_CATALOG.filter((item) => item.chapter === chapter.id).map(
                    (item) => {
                      const state = item.tier < level.tier
                        ? "completed"
                        : item.tier === level.tier
                          ? "current"
                          : "future";
                      const name = t(`levels.${item.key}.name` as LevelCopyKey);
                      const selected = item.key === selectedKey;
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => onSelect(item.key)}
                          aria-pressed={selected}
                          aria-label={t("guide_level_aria", {
                            tier: item.tier,
                            name,
                            state: t(`states.${state}`),
                          })}
                          className={`relative flex min-h-24 flex-col items-center justify-center rounded-[var(--radius-card)] border p-2 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] ${
                            selected
                              ? "border-[var(--color-progress)] bg-[var(--color-soft)]"
                              : "border-[var(--color-border)]"
                          }`}
                        >
                          <JourneyLevelMedallion
                            levelKey={item.key}
                            current={state === "current"}
                            future={state === "future"}
                            className="size-16"
                          />
                          <span className="mt-1 line-clamp-1 text-xs font-bold text-[var(--color-main)]">
                            {name}
                          </span>
                          <span className="absolute right-1.5 top-1.5 text-[var(--color-secondary)]">
                            {state === "completed" ? <Check size={13} aria-hidden="true" /> : null}
                          </span>
                        </button>
                      );
                    },
                  )}
                </div>
              </section>
            ))}
          </div>

          {/* Detail sits above the chapter grid on mobile so the selected level stays visible
              without scrolling; on lg it returns to DOM order as the right column. Safe to reorder
              visually — the panel holds no focusable elements, so tab order is unaffected. */}
          <section className="order-first rounded-[var(--radius-card)] bg-[var(--color-soft)] p-5 text-center lg:order-none lg:self-start">
            <JourneyLevelMedallion
              levelKey={selectedLevel.key}
              current={selectedLevel.tier === level.tier}
              future={selectedLevel.tier > level.tier}
              className="mx-auto size-28"
            />
            <p className="mt-3 text-xs font-bold uppercase tracking-wide text-[var(--color-accent)]">
              {t("level_label", { tier: selectedLevel.tier })}
            </p>
            <h3 className="mt-1 text-lg font-bold text-[var(--color-main)]">{selectedName}</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--color-secondary)]">{selectedStory}</p>
            {isOwner && selectedLevel.tier === level.tier && level.progress ? (
              <div className="mt-4 text-left">
                <div className="flex justify-between gap-3 text-xs text-[var(--color-secondary)]">
                  <span>{t("progress_label")}</span>
                  <span className="tabular-nums">
                    {level.progress.current.toLocaleString(locale)} / {level.progress.target.toLocaleString(locale)} XP
                  </span>
                </div>
                <JourneyLevelProgressBar
                  progress={level.progress}
                  ariaLabel={t("progress_aria", { name: selectedName })}
                  ariaValueText={t("progress_value", {
                    current: level.progress.current,
                    target: level.progress.target,
                  })}
                />
              </div>
            ) : null}
          </section>
        </div>
      </motion.section>
    </motion.div>
  );
}
