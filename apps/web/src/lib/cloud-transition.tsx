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
import dynamic from "next/dynamic";

import { usePathname } from "@/i18n/navigation";

const CloudTransitionOverlay = dynamic(() =>
  import("./cloud-transition-overlay").then((module) => module.CloudTransitionOverlay),
);

export type CloudTransitionPhase =
  | "idle"
  | "covering"
  | "covered"
  | "revealing";

type CloudTransitionEvent = "start" | "covered" | "coverTimeout" | "ready" | "timeout" | "revealed";

export function cloudTransitionReducer(
  phase: CloudTransitionPhase,
  event: CloudTransitionEvent,
): CloudTransitionPhase {
  if (event === "start") return phase === "idle" ? "covering" : phase;
  if (event === "covered" || event === "coverTimeout") {
    return phase === "covering" ? "covered" : phase;
  }
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

  // The overlay chunk is what calls onDone. If it never arrives, navigate anyway.
  useEffect(() => {
    if (phase !== "covering") return;
    const timeout = window.setTimeout(() => {
      dispatch("coverTimeout");
      const navigate = navigateRef.current;
      navigateRef.current = null;
      navigate?.();
    }, DESTINATION_TIMEOUT_MS);
    return () => window.clearTimeout(timeout);
  }, [phase]);

  useEffect(() => {
    if (phase !== "covered") return;
    const timeout = window.setTimeout(() => dispatch("timeout"), DESTINATION_TIMEOUT_MS);
    return () => window.clearTimeout(timeout);
  }, [phase]);

  /*
   * The machine runs on a REAL animation (APP-089). `onAnimationComplete` dispatches "covered"
   * and calls `navigate()`, so the left cloud always has a distance to travel. The covering
   * timeout above is the fallback when that callback never arrives.
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

  return (
    <CloudTransitionContext.Provider value={{ startCloudTransition, reportDestinationReady }}>
      {children}
      {visible ? <CloudTransitionOverlay covering={covering} onDone={handleCoverAnimationComplete} /> : null}
    </CloudTransitionContext.Provider>
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
