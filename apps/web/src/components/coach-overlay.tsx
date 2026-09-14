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

/** Mounted overlays, innermost last: the calendar stacks a form over a detail, and Escape closes one. */
const openOverlays: object[] = [];

/**
 * The coach surfaces' overlay: a right-hand drawer (or a centred inspector) on desktop, a bottom
 * sheet with a drag handle on phones. Shared by the coach calendar (`/plan`) and the student report
 * (`/kocluk/[studentId]`), so both open and close the same way.
 *
 * Render it inside `AnimatePresence`; it unmounts on close. Focus goes back to whatever opened it.
 */
export function CoachOverlay({
  variant,
  layer,
  labelledBy,
  busy,
  grouped = false,
  onClose,
  children,
}: {
  variant: "drawer" | "inspector";
  layer: "form" | "detail";
  labelledBy: string;
  busy?: boolean;
  /** Page-coloured panel, for content laid out as surface-coloured groups (the student report). */
  grouped?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const panelRef = useRef<HTMLElement>(null);
  const dragControls = useDragControls();
  const [desktop, setDesktop] = useState(() =>
    typeof window !== "undefined" && window.matchMedia(DESKTOP_QUERY).matches,
  );

  const latest = useRef({ busy, onClose });
  useEffect(() => {
    latest.current = { busy, onClose };
  });

  /*
   * Escape is heard on the window, not on the panel: picking from a portaled menu or calendar leaves
   * focus outside the panel, and a panel-level listener then ignored Escape entirely. An open menu
   * still wins, because PopoverMenu stops Escape in the capture phase. Only the top overlay closes.
   *
   * Like a native dialog, focus returns to the control that opened the overlay when it goes away.
   */
  useEffect(() => {
    const token = {};
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    openOverlays.push(token);
    function onKey(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (openOverlays.at(-1) !== token || latest.current.busy) return;
      latest.current.onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      openOverlays.splice(openOverlays.indexOf(token), 1);
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

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
        className="absolute inset-0 cursor-default bg-[#111111]/40 backdrop-blur-sm [@media(prefers-reduced-transparency:reduce)]:backdrop-blur-none"
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
        className={`relative flex min-h-0 flex-col overflow-hidden border border-[var(--color-border)] shadow-[var(--shadow-card)] ${
          grouped ? "bg-[var(--color-bg)]" : "bg-[var(--color-surface)]"
        } ${
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
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </motion.aside>
    </motion.div>
  );
}

export function CoachOverlayHeader({ children }: { children: ReactNode }) {
  return (
    <div className="flex shrink-0 items-start justify-between gap-3 px-6 pb-3 pt-5 lg:pt-6">
      {children}
    </div>
  );
}

export function CoachOverlayBody({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-2">
      {children}
    </div>
  );
}

export function CoachOverlayFooter({ children }: { children: ReactNode }) {
  return (
    <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-[var(--color-border)] px-6 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
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
