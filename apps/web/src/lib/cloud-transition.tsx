"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
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

type CloudTransitionEvent =
  | "start"
  | "covered"
  | "routeChanged"
  | "timeout"
  | "revealed";

export function cloudTransitionReducer(
  phase: CloudTransitionPhase,
  event: CloudTransitionEvent,
): CloudTransitionPhase {
  if (event === "start") return phase === "idle" ? "covering" : phase;
  if (event === "covered") return phase === "covering" ? "covered" : phase;
  if (event === "routeChanged" || event === "timeout") {
    return phase === "covered" ? "revealing" : phase;
  }
  if (event === "revealed") return phase === "revealing" ? "idle" : phase;
  return phase;
}

type CloudTransitionContextValue = {
  startCloudTransition: (navigate: () => void) => void;
};

const CloudTransitionContext = createContext<CloudTransitionContextValue | null>(null);

const ROUTE_CHANGE_TIMEOUT_MS = 3_500;

export function CloudTransitionProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion() ?? false;
  const [phase, dispatch] = useReducer(cloudTransitionReducer, "idle");
  const originPathRef = useRef(pathname);
  const navigateRef = useRef<(() => void) | null>(null);

  const startCloudTransition = useCallback(
    (navigate: () => void) => {
      if (phase !== "idle") return;
      originPathRef.current = pathname;
      navigateRef.current = navigate;
      dispatch("start");
    },
    [pathname, phase],
  );

  useEffect(() => {
    if (phase !== "covered" || pathname === originPathRef.current) return;
    const frame = requestAnimationFrame(() => dispatch("routeChanged"));
    return () => cancelAnimationFrame(frame);
  }, [pathname, phase]);

  useEffect(() => {
    if (phase !== "covered") return;
    const timeout = window.setTimeout(
      () => dispatch("timeout"),
      ROUTE_CHANGE_TIMEOUT_MS,
    );
    return () => window.clearTimeout(timeout);
  }, [phase]);

  const handleAnimationComplete = () => {
    if (phase === "covering") {
      dispatch("covered");
      const navigate = navigateRef.current;
      navigateRef.current = null;
      navigate?.();
      return;
    }
    if (phase === "revealing") dispatch("revealed");
  };

  const visible = phase !== "idle";
  const covering = phase === "covering" || phase === "covered";
  const duration = reduceMotion ? 0.08 : 0.5;

  return (
    <CloudTransitionContext.Provider value={{ startCloudTransition }}>
      {children}
      {visible ? (
        <motion.div
          className="pointer-events-auto fixed inset-0 overflow-hidden"
          style={{ zIndex: "var(--z-route-transition)" }}
          initial={false}
          animate={{ opacity: covering ? 1 : 0 }}
          transition={{ duration, ease: [0.22, 1, 0.36, 1] }}
          onAnimationComplete={handleAnimationComplete}
          aria-hidden
        >
          <CloudFallbackLayer
            position="left"
            src={CLOUD_ASSETS?.left}
            covered={covering}
            duration={duration}
          />
          <CloudFallbackLayer
            position="right"
            src={CLOUD_ASSETS?.right}
            covered={covering}
            duration={duration}
          />
          <CloudFallbackLayer
            position="bottom"
            src={CLOUD_ASSETS?.bottom}
            covered={covering}
            duration={duration}
          />
        </motion.div>
      ) : null}
    </CloudTransitionContext.Provider>
  );
}

function CloudFallbackLayer({
  position,
  src,
  covered,
  duration,
}: {
  position: "left" | "right" | "bottom";
  src?: string;
  covered: boolean;
  duration: number;
}) {
  const transforms = {
    left: { x: covered ? "-18%" : "-115%", y: "-8%" },
    right: { x: covered ? "18%" : "115%", y: "-5%" },
    bottom: { x: 0, y: covered ? "24%" : "115%" },
  } as const;

  return (
    <motion.div
      className={
        position === "bottom"
          ? "absolute -inset-x-[15%] bottom-0 h-[88%] rounded-[50%]"
          : `absolute top-0 h-[120%] w-[72%] rounded-[50%] ${position === "left" ? "left-0" : "right-0"}`
      }
      style={src ? undefined : {
        background: "radial-gradient(circle at 48% 38%, #ffffff 0 42%, #eef4ff 72%, #d6dbfd 100%)",
        boxShadow: "var(--shadow-card)",
      }}
      initial={false}
      animate={transforms[position]}
      transition={{ duration, ease: [0.22, 1, 0.36, 1] }}
    >
      {src ? <Image src={src} alt="" fill sizes="100vw" className="object-contain" aria-hidden /> : null}
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
