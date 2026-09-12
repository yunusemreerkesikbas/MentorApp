"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CalendarPlus, ListPlus, Plus } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";

const EASE = [0.22, 1, 0.36, 1] as const;

const ACTIONS = [
  { id: "task" as const, y: -80, Icon: ListPlus, labelKey: "new_task" },
  { id: "event" as const, y: -148, Icon: CalendarPlus, labelKey: "new_event" },
];

export function CoachPlanComposeFab({
  onNewTask,
  onNewEvent,
}: {
  onNewTask: (trigger: HTMLButtonElement) => void;
  onNewEvent: (trigger: HTMLButtonElement) => void;
}) {
  const t = useTranslations("coachPlan");
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const filterId = `coach-plan-goo-${useId().replace(/:/g, "")}`;
  const openMs = reduceMotion ? 0 : 0.25;
  const closeMs = reduceMotion ? 0 : 0.15;

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function pick(kind: "task" | "event") {
    const trigger = triggerRef.current;
    setOpen(false);
    if (!trigger) return;
    if (kind === "task") onNewTask(trigger);
    else onNewEvent(trigger);
  }

  return (
    <>
      <AnimatePresence>
        {open ? (
          <motion.button
            key="compose-scrim"
            type="button"
            aria-label={t("compose_close")}
            className="fixed inset-0 z-50 cursor-default"
            style={{
              background: "color-mix(in srgb, var(--color-main) 20%, transparent)",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: closeMs, ease: EASE }}
            onClick={() => setOpen(false)}
          />
        ) : null}
      </AnimatePresence>

      <div className="fixed right-5 bottom-[calc(96px+env(safe-area-inset-bottom))] z-[51] h-14 w-14">
        <svg aria-hidden className="absolute h-0 w-0">
          <defs>
            <filter id={filterId}>
              <feGaussianBlur in="SourceGraphic" result="blur" stdDeviation="8" />
              <feColorMatrix
                in="blur"
                mode="matrix"
                result="goo"
                values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7"
              />
              <feComposite in="SourceGraphic" in2="goo" operator="atop" />
            </filter>
          </defs>
        </svg>

        <div
          className="pointer-events-none absolute right-0 bottom-0 h-[220px] w-14"
          style={{ filter: `url(#${filterId})` }}
        >
          {ACTIONS.map((action) => (
            <motion.div
              key={action.id}
              className="absolute right-0 bottom-0 size-14 rounded-full"
              style={{ backgroundColor: "var(--color-btn)" }}
              initial={false}
              animate={open ? { y: action.y, opacity: 1 } : { y: 0, opacity: 0 }}
              transition={{
                duration: open ? openMs : closeMs,
                ease: EASE,
              }}
            />
          ))}
          <div
            className="absolute right-0 bottom-0 size-14 rounded-full"
            style={{ backgroundColor: "var(--color-btn)" }}
          />
        </div>

        {ACTIONS.map((action) => (
          <motion.button
            key={action.id}
            type="button"
            onClick={() => pick(action.id)}
            tabIndex={open ? 0 : -1}
            aria-hidden={!open}
            className={`absolute right-0 bottom-0 flex size-14 cursor-pointer flex-col items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] ${open ? "" : "pointer-events-none"}`}
            style={{ color: "var(--color-btn-label)" }}
            initial={false}
            animate={open ? { y: action.y, opacity: 1 } : { y: 0, opacity: 0 }}
            transition={{ duration: open ? openMs : closeMs, ease: EASE }}
          >
            <action.Icon aria-hidden size={22} strokeWidth={2.2} />
            <span className="sr-only">{t(action.labelKey)}</span>
          </motion.button>
        ))}

        <AnimatePresence>
          {open
            ? ACTIONS.map((action) => (
                <motion.span
                  key={`${action.id}-label`}
                  aria-hidden
                  className="pointer-events-none absolute right-16 bottom-0 whitespace-nowrap rounded-[var(--radius-card)] px-3 py-1 text-sm font-semibold"
                  style={{
                    color: "var(--color-main)",
                    backgroundColor:
                      "color-mix(in srgb, var(--color-surface) 92%, transparent)",
                    boxShadow: "var(--shadow-card)",
                  }}
                  initial={
                    reduceMotion
                      ? { opacity: 0, y: action.y + 14 }
                      : { opacity: 0, x: 8, y: action.y + 14 }
                  }
                  animate={{ opacity: 1, x: 0, y: action.y + 14 }}
                  exit={
                    reduceMotion
                      ? { opacity: 0, y: action.y + 14 }
                      : { opacity: 0, x: 8, y: action.y + 14 }
                  }
                  transition={{ duration: openMs, ease: EASE }}
                >
                  {t(action.labelKey)}
                </motion.span>
              ))
            : null}
        </AnimatePresence>

        <button
          ref={triggerRef}
          type="button"
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label={open ? t("compose_close") : t("compose_open")}
          onClick={() => setOpen((value) => !value)}
          className="absolute right-0 bottom-0 z-10 flex size-14 cursor-pointer items-center justify-center rounded-full shadow-[var(--shadow-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          style={{ backgroundColor: "var(--color-btn)", color: "var(--color-btn-label)" }}
        >
          <motion.span
            className="flex"
            animate={{ rotate: open ? 45 : 0 }}
            transition={{ duration: open ? openMs : closeMs, ease: EASE }}
          >
            <Plus aria-hidden size={26} strokeWidth={2.5} />
          </motion.span>
        </button>
      </div>
    </>
  );
}
