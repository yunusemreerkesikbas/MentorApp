"use client";

import { CalendarPlus, ListPlus, Plus } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";

const EASE = [0.22, 1, 0.36, 1] as const;

const ACTIONS = [
  { id: "task" as const, y: -80, Icon: ListPlus, labelKey: "new_task" },
  { id: "event" as const, y: -148, Icon: CalendarPlus, labelKey: "new_event" },
];

export function CoachPlanComposeFab({
  hidden,
  onNewTask,
  onNewEvent,
}: {
  hidden?: boolean;
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

  // Reset while hidden by adjusting state during render (no effect round-trip).
  if (hidden && open) setOpen(false);

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

  if (hidden) return null;

  return (
    <>
      <AnimatePresence>
        {open ? (
          <motion.button
            key="compose-scrim"
            type="button"
            aria-label={t("compose_close")}
            className="fixed inset-0 z-[45] cursor-default bg-[#111111]/40 backdrop-blur-sm [@media(prefers-reduced-transparency:reduce)]:backdrop-blur-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: closeMs, ease: EASE }}
            onClick={() => setOpen(false)}
          />
        ) : null}
      </AnimatePresence>

      {/* The student's plan button (`PlanCalendarFab`): the same black and height above the tab bar. */}
      <div className="fixed right-5 bottom-[calc(96px+env(safe-area-inset-bottom))] z-[45] h-14 w-14 lg:bottom-8">
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
              transition={{ duration: open ? openMs : closeMs, ease: EASE }}
            />
          ))}
          <div
            className="absolute right-0 bottom-0 size-14 rounded-full"
            style={{ backgroundColor: "var(--color-btn)" }}
          />
        </div>

        {ACTIONS.map((action) => (
          <motion.div
            key={action.id}
            className="absolute right-0 bottom-0 flex h-14 items-center"
            initial={false}
            animate={open ? { y: action.y, opacity: 1 } : { y: 0, opacity: 0 }}
            transition={{ duration: open ? openMs : closeMs, ease: EASE }}
          >
            <span
              aria-hidden
              className="pointer-events-none absolute right-16 whitespace-nowrap rounded-[var(--radius-card)] px-3 py-1 text-sm font-semibold"
              style={{
                color: "var(--color-main)",
                backgroundColor:
                  "color-mix(in srgb, var(--color-surface) 92%, transparent)",
                boxShadow: "var(--shadow-card)",
              }}
            >
              {t(action.labelKey)}
            </span>
            <button
              type="button"
              onClick={() => pick(action.id)}
              tabIndex={open ? 0 : -1}
              aria-hidden={!open}
              className={`flex size-14 cursor-pointer items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] ${open ? "" : "pointer-events-none"}`}
              style={{ color: "var(--color-btn-label)" }}
            >
              <action.Icon aria-hidden size={22} strokeWidth={2.2} />
              <span className="sr-only">{t(action.labelKey)}</span>
            </button>
          </motion.div>
        ))}

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
