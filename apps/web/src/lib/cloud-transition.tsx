"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";

import { usePathname } from "@/i18n/navigation";
import { CLOUD_ASSETS } from "@/lib/onboarding-assets";

export type CloudTransitionPhase =
  | "idle"
  | "covering"
  | "covered"
  | "revealing";

type CloudTransitionEvent = "start" | "covered" | "ready" | "timeout" | "revealed";

export function cloudTransitionReducer(
  phase: CloudTransitionPhase,
  event: CloudTransitionEvent,
): CloudTransitionPhase {
  if (event === "start") return phase === "idle" ? "covering" : phase;
  if (event === "covered") return phase === "covering" ? "covered" : phase;
  if (event === "ready" || event === "timeout") {
    return phase === "covered" ? "revealing" : phase;
  }
  if (event === "revealed") return phase === "revealing" ? "idle" : phase;
  return phase;
}

type CloudTransitionContextValue = {
  startCloudTransition: (navigate: () => void) => void;
  /** Destination pages report through {@link useCloudTransitionReady}, not by calling this. */
  reportDestinationReady: (path: string) => void;
};

const CloudTransitionContext = createContext<CloudTransitionContextValue | null>(null);

/**
 * How long the clouds wait for a destination that never says it is ready — a page without the
 * ready hook, a fetch that hangs. Long enough for a cold panel load, short enough that nobody is
 * left staring at a sky.
 */
const DESTINATION_TIMEOUT_MS = 6_000;

export function CloudTransitionProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion() ?? false;
  const [phase, dispatch] = useReducer(cloudTransitionReducer, "idle");
  /** The path that last reported itself ready — a signal is only worth acting on for its own page. */
  const [readyPath, setReadyPath] = useState<string | null>(null);
  const originPathRef = useRef(pathname);
  const navigateRef = useRef<(() => void) | null>(null);

  const startCloudTransition = useCallback(
    (navigate: () => void) => {
      if (phase !== "idle") return;
      originPathRef.current = pathname;
      navigateRef.current = navigate;
      setReadyPath(null);
      dispatch("start");
    },
    [pathname, phase],
  );

  const reportDestinationReady = useCallback((path: string) => setReadyPath(path), []);

  /*
   * The signal parts the clouds only when it comes from the page now on screen, and that page is
   * not the one we covered. The page being covered has its data too, and taking its word for it
   * would open the sky on the screen the user just left.
   */
  useEffect(() => {
    if (phase !== "covered" || readyPath !== pathname || pathname === originPathRef.current) return;
    const frame = requestAnimationFrame(() => dispatch("ready"));
    return () => cancelAnimationFrame(frame);
  }, [pathname, phase, readyPath]);

  useEffect(() => {
    if (phase !== "covered") return;
    const timeout = window.setTimeout(() => dispatch("timeout"), DESTINATION_TIMEOUT_MS);
    return () => window.clearTimeout(timeout);
  }, [phase]);

  /*
   * The machine runs on a REAL animation (APP-089). `onAnimationComplete` is the only thing that
   * dispatches "covered" and calls `navigate()`, so the left cloud always has a distance to travel
   * — with `initial={false}` the phase stuck on "covering" and navigation never happened.
   */
  function handleCoverAnimationComplete() {
    if (phase === "covering") {
      dispatch("covered");
      const navigate = navigateRef.current;
      navigateRef.current = null;
      navigate?.();
      return;
    }
    if (phase === "revealing") dispatch("revealed");
  }

  const visible = phase !== "idle";
  const covering = phase === "covering" || phase === "covered";
  const duration = reduceMotion ? 0.12 : 0.62;

  return (
    <CloudTransitionContext.Provider value={{ startCloudTransition, reportDestinationReady }}>
      {children}
      {visible ? (
        <div
          className="pointer-events-auto fixed inset-0 overflow-hidden"
          style={{ zIndex: "var(--z-route-transition)" }}
          aria-hidden
        >
          {/*
            Sky behind the clouds, so the corners they cannot reach are not a torn hole. It arrives
            late and leaves early: the clouds have to be seen sweeping over the page, not landing on
            a white screen that was already there.
          */}
          <motion.div
            className="absolute inset-0 bg-[var(--color-bg)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: covering ? 1 : 0 }}
            transition={{ duration: duration * 0.45, ease: "easeOut", delay: covering ? duration * 0.45 : 0 }}
          />
          <CloudLayer side="left" covering={covering} duration={duration} onDone={handleCoverAnimationComplete} />
          <CloudLayer side="right" covering={covering} duration={duration} />
        </div>
      ) : null}
    </CloudTransitionContext.Provider>
  );
}

function CloudLayer({
  side,
  covering,
  duration,
  onDone,
}: {
  side: "left" | "right";
  covering: boolean;
  duration: number;
  /** Only the left cloud drives the machine; two callbacks would fire the same transition twice. */
  onDone?: () => void;
}) {
  const parked = side === "left" ? "-104%" : "104%";
  // The outer half runs off screen; the puffy inner edge is the one that has to stay.
  const anchor = side === "left" ? "object-right-bottom" : "object-left-bottom";

  return (
    <motion.div
      className={`absolute inset-y-0 flex w-[92%] flex-col ${side === "left" ? "left-0" : "right-0"}`}
      initial={{ x: parked }}
      animate={{ x: covering ? "0%" : parked }}
      transition={{ duration, ease: [0.22, 1, 0.36, 1] }}
      onAnimationComplete={onDone}
    >
      {/*
        The art is one landscape cluster, so a single copy leaves half a portrait screen as sky.
        Mirroring it across the middle builds a full-height wall whose inner edge stays puffy.
      */}
      <div className="relative flex-1">
        <Image src={CLOUD_ASSETS[side]} alt="" fill priority sizes="92vw" className={`object-cover ${anchor}`} />
      </div>
      {/*
        Overlapped and a size larger, so the lower bank swallows the hollow the upper one leaves at
        the mirror line rather than repeating it. Nudging it sideways instead would bare a strip at
        the outer edge, which reads as a rectangle; a bigger cloud only ever overlaps more cloud.
      */}
      <div className="relative -mt-[15%] flex-1 scale-x-110 -scale-y-110">
        <Image src={CLOUD_ASSETS[side]} alt="" fill sizes="92vw" className={`object-cover ${anchor}`} />
      </div>
    </motion.div>
  );
}

export function useCloudTransition(): CloudTransitionContextValue {
  const value = useContext(CloudTransitionContext);
  if (!value) {
    throw new Error("useCloudTransition must be used inside CloudTransitionProvider");
  }
  return value;
}

/**
 * A destination page's half of the handover: the clouds stay shut until the screen behind them has
 * its data, then part on a finished page instead of a skeleton. Safe to call unconditionally — it
 * does nothing unless a transition is waiting.
 */
export function useCloudTransitionReady(ready: boolean): void {
  const { reportDestinationReady } = useCloudTransition();
  const pathname = usePathname();

  useEffect(() => {
    if (ready) reportDestinationReady(pathname);
  }, [pathname, ready, reportDestinationReady]);
}
