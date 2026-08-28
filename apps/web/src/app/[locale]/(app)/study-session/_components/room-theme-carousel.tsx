"use client";

import { useCallback, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import type { StudyRoomTheme } from "@mentor/types";
import { STUDY_ROOM_BACKDROP_SRC, STUDY_ROOM_THEME_IDS } from "@/lib/study-room-theme";

const SLIDE_DISTANCE = 56;
const SWIPE_THRESHOLD = 48;

/**
 * Theme picker as a room you step through, not a dropdown you read. Each move slides the whole
 * scene — ground, table, name — because the thing being chosen *is* an atmosphere; a `<select>`
 * makes it a database value.
 *
 * Slides carry a direction so the motion matches the control that caused it: pressing "next"
 * always moves left, wrapping included. Drag works on touch, arrow keys on a keyboard, and
 * `prefers-reduced-motion` collapses the travel to a crossfade without removing the change.
 */
export function RoomThemeCarousel({
  value,
  onChange,
  disabled,
}: {
  value: StudyRoomTheme;
  onChange: (theme: StudyRoomTheme) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("session_room");
  const reduceMotion = useReducedMotion();
  // Direction and theme are set in the same event, so React has both by the time the new
  // slide renders — the exiting and entering slides agree on which way the room moved.
  const [direction, setDirection] = useState(1);
  /**
   * Which room photo 404'd, by source — a theme whose art has not shipped yet must not drag
   * the ones that have down to the CSS drawing with it. Lives here rather than on the slide
   * because the slide is keyed by theme and remounts on every step, which would forget it.
   */
  const [failedSrc, setFailedSrc] = useState<readonly string[]>([]);
  const backdropSrc = STUDY_ROOM_BACKDROP_SRC[value];
  const backdropFailed = failedSrc.includes(backdropSrc);

  const index = Math.max(0, STUDY_ROOM_THEME_IDS.indexOf(value));

  const step = useCallback(
    (delta: number) => {
      if (disabled) return;
      setDirection(delta);
      const next = (index + delta + STUDY_ROOM_THEME_IDS.length) % STUDY_ROOM_THEME_IDS.length;
      onChange(STUDY_ROOM_THEME_IDS[next]!);
    },
    [disabled, index, onChange],
  );

  return (
    <div
      role="group"
      aria-label={t("theme_label")}
      // Scoped here too, not just on the slide: the arrows and dots live outside the animated
      // element and would otherwise read an undefined `--room-*` family. The slide keeps its
      // own scope so an exiting theme fades out in its own colours instead of snapping.
      className="room-stage relative overflow-hidden"
      data-room-theme={value}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          step(-1);
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          step(1);
        }
      }}
      tabIndex={0}
    >
      <AnimatePresence initial={false} mode="popLayout">
        <motion.div
          key={value}
          className="room-stage relative flex h-44 items-center justify-center"
          data-room-theme={value}
          drag={disabled || reduceMotion ? false : "x"}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.14}
          onDragEnd={(_, info) => {
            if (info.offset.x < -SWIPE_THRESHOLD) step(1);
            else if (info.offset.x > SWIPE_THRESHOLD) step(-1);
          }}
          initial={
            reduceMotion
              ? { opacity: 0 }
              : { opacity: 0, x: direction > 0 ? SLIDE_DISTANCE : -SLIDE_DISTANCE }
          }
          animate={{ opacity: 1, x: 0 }}
          exit={
            reduceMotion
              ? { opacity: 0 }
              : { opacity: 0, x: direction > 0 ? -SLIDE_DISTANCE : SLIDE_DISTANCE }
          }
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* The room itself, not a diagram of one. You are choosing an atmosphere: a wash
              plus a beige ellipse made "Kütüphane" and "Kafe" differ only by background
              colour, which is no basis for a choice. The CSS drawing stays as the fallback,
              so a theme whose photo has not shipped yet still renders something furniture-
              shaped instead of an empty panel — and dropping the file in needs no code. */}
          {backdropFailed ? (
            <>
              <div
                aria-hidden
                className="absolute inset-0"
                style={{
                  background:
                    "radial-gradient(120% 100% at 50% 0%, var(--room-ground-from) 0%, var(--room-ground-to) 100%)",
                }}
              />
              <div aria-hidden className="relative mt-6 h-16 w-40">
                <div
                  className="absolute inset-x-0 top-3 h-full rounded-[50%] blur-lg"
                  style={{
                    backgroundColor:
                      "color-mix(in srgb, var(--room-table-edge) 45%, transparent)",
                  }}
                />
                <div
                  className="absolute inset-x-0 top-2 h-full rounded-[50%]"
                  style={{ backgroundColor: "var(--room-table-edge)" }}
                />
                <div
                  className="absolute inset-x-0 top-0 h-full rounded-[50%]"
                  style={{
                    background:
                      "radial-gradient(120% 140% at 50% 22%, color-mix(in srgb, #ffffff 16%, var(--room-table)) 0%, var(--room-table) 62%)",
                  }}
                />
              </div>
            </>
          ) : (
            <Image
              src={backdropSrc}
              alt=""
              fill
              sizes="(min-width: 640px) 28rem, 100vw"
              className="pointer-events-none object-cover"
              onError={() =>
                setFailedSrc((prev) =>
                  prev.includes(backdropSrc) ? prev : [...prev, backdropSrc],
                )
              }
            />
          )}
          {/* Scrim under the name only — the photo is the point, so it is not veiled whole. */}
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-20"
            style={{
              background:
                "linear-gradient(to top, var(--room-ground-to) 12%, transparent 100%)",
            }}
          />
          <span
            className="absolute bottom-4 text-sm font-bold"
            style={{
              color: "var(--room-ink)",
              fontFamily: "var(--font-heading)",
              textShadow: "0 1px 4px var(--room-ground-to)",
            }}
          >
            {t(`theme_${value}`)}
          </span>
        </motion.div>
      </AnimatePresence>

      <CarouselArrow side="left" label={t("theme_prev")} disabled={disabled} onClick={() => step(-1)} />
      <CarouselArrow side="right" label={t("theme_next")} disabled={disabled} onClick={() => step(1)} />

      <div className="pointer-events-none absolute inset-x-0 bottom-1 flex justify-center gap-1.5">
        {STUDY_ROOM_THEME_IDS.map((id) => (
          <span
            key={id}
            aria-hidden
            className="size-1.5 rounded-full transition-opacity duration-200 motion-reduce:transition-none"
            style={{
              backgroundColor: "var(--room-ink)",
              opacity: id === value ? 0.85 : 0.25,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function CarouselArrow({
  side,
  label,
  onClick,
  disabled,
}: {
  side: "left" | "right";
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`absolute top-1/2 z-10 inline-flex size-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full transition-opacity duration-200 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--room-accent)] disabled:opacity-40 motion-reduce:transition-none ${
        side === "left" ? "left-2" : "right-2"
      }`}
      style={{ backgroundColor: "var(--room-scrim)", color: "var(--room-ink)", opacity: 0.9 }}
    >
      <Icon className="size-5" strokeWidth={2.5} aria-hidden />
    </button>
  );
}
