"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { motion, useDragControls, useReducedMotion } from "framer-motion";

const EASE = [0.22, 1, 0.36, 1] as const;
const DESKTOP_QUERY = "(min-width: 1024px)";

export function CoachPlanOverlay({
  variant,
  layer,
  labelledBy,
  busy,
  onClose,
  children,
}: {
  variant: "drawer" | "inspector";
  layer: "form" | "detail";
  labelledBy: string;
  busy?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const panelRef = useRef<HTMLElement>(null);
  const dragControls = useDragControls();
  const [desktop, setDesktop] = useState(() =>
    typeof window !== "undefined" && window.matchMedia(DESKTOP_QUERY).matches,
  );

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_QUERY);
    const sync = () => setDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const form = layer === "form";
  const sheet = !desktop;
  const drawer = variant === "drawer";
  const openDur = reduceMotion ? 0 : drawer ? 0.4 : 0.25;
  const closeDur = reduceMotion ? 0 : drawer ? 0.35 : 0.15;
  const hidden = panelHidden(reduceMotion === true, drawer, desktop);
  const shown = { opacity: 1, x: 0, y: 0, scale: 1 };

  function startDrag(event: PointerEvent<HTMLDivElement>) {
    if (!sheet || busy) return;
    dragControls.start(event);
  }

  return (
    <motion.div
      className={`fixed inset-0 flex ${form ? "z-50" : "z-40"} ${
        sheet ? "items-end" : drawer ? "justify-end" : "items-center justify-center p-5"
      }`}
      initial="hidden"
      animate="shown"
      exit="hidden"
      variants={{
        hidden: { transition: { duration: closeDur, ease: EASE, when: "afterChildren" } },
        shown: { transition: { duration: openDur, ease: EASE, when: "beforeChildren" } },
      }}
    >
      <motion.button
        type="button"
        tabIndex={-1}
        aria-hidden
        className="absolute inset-0 cursor-default backdrop-blur-xl [@media(prefers-reduced-transparency:reduce)]:backdrop-blur-none"
        style={{
          background: "color-mix(in srgb, var(--color-main) 55%, transparent)",
        }}
        variants={{
          hidden: { opacity: 0 },
          shown: { opacity: 1, transition: { duration: openDur, ease: EASE } },
        }}
        transition={{ duration: closeDur, ease: EASE }}
        onClick={() => {
          if (!busy) onClose();
        }}
      />
      <motion.aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        drag={sheet && !busy ? "y" : false}
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.18 }}
        onDragEnd={(_, info) => {
          if (busy) return;
          if (info.offset.y > 80 || info.velocity.y > 500) onClose();
        }}
        className={`relative flex min-h-0 flex-col overflow-hidden border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-surface)_92%,transparent)] shadow-[var(--shadow-card)] backdrop-blur-2xl backdrop-saturate-[190%] [@media(prefers-reduced-transparency:reduce)]:bg-[var(--color-surface)] [@media(prefers-reduced-transparency:reduce)]:backdrop-blur-none ${
          sheet
            ? `w-full rounded-t-[var(--radius-card)] ${drawer ? "max-h-[90dvh]" : "max-h-[60dvh]"}`
            : drawer
              ? "h-full w-full max-w-xl rounded-none border-y-0 border-r-0"
              : "w-full max-w-md rounded-[var(--radius-card)]"
        }`}
        variants={{
          hidden,
          shown: { ...shown, transition: { duration: openDur, ease: EASE } },
        }}
        transition={{ duration: closeDur, ease: EASE }}
        onKeyDown={(event) => {
          if (event.key === "Escape" && !busy) onClose();
          if (event.key === "Tab") trapFocus(event, panelRef.current);
        }}
      >
        {sheet ? (
          <div
            className="flex h-6 shrink-0 cursor-grab items-center justify-center active:cursor-grabbing"
            onPointerDown={startDrag}
          >
            <div
              className="h-1 w-9 rounded-full"
              style={{
                backgroundColor: "color-mix(in srgb, var(--color-secondary) 40%, transparent)",
              }}
            />
          </div>
        ) : null}
        {children}
      </motion.aside>
    </motion.div>
  );
}

export function CoachPlanOverlayBody({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-1">
      {children}
    </div>
  );
}

function panelHidden(reduce: boolean, drawer: boolean, desktop: boolean) {
  if (reduce) return { opacity: 0, x: 0, y: 0, scale: 1 };
  if (drawer && desktop) return { opacity: 1, x: "100%", y: 0, scale: 1 };
  if (!desktop) return { opacity: 1, x: 0, y: "100%", scale: 1 };
  return { opacity: 0, x: 0, y: 0, scale: 0.96 };
}

function trapFocus(event: KeyboardEvent, panel: HTMLElement | null): void {
  if (!panel) return;
  const focusable = [...panel.querySelectorAll<HTMLElement>(
    "input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [href]",
  )];
  const first = focusable[0];
  const last = focusable.at(-1);
  if (!first || !last) return;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
