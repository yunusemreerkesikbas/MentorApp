"use client";

import type * as React from "react";
import { useEffect, useRef, useState } from "react";

import { forceReflow, prefersReducedMotion, readCssMs } from "./motion-utils.js";

export interface TextSwapProps {
  text: string;
  className?: string;
  style?: React.CSSProperties;
  as?: "span" | "p" | "strong" | "em";
}

/**
 * In-place text swap with blur + short Y travel when `text` changes.
 */
export function TextSwap({ text, className, style, as: Tag = "span" }: TextSwapProps) {
  const ref = useRef<HTMLElement>(null);
  const [display, setDisplay] = useState(text);
  const [phase, setPhase] = useState<"idle" | "exit" | "enter-start">("idle");
  const prevRef = useRef(text);
  const runningRef = useRef(false);

  useEffect(() => {
    if (prevRef.current === text) return;
    const el = ref.current;
    if (!el || prefersReducedMotion() || runningRef.current) {
      prevRef.current = text;
      setDisplay(text);
      setPhase("idle");
      return;
    }

    runningRef.current = true;
    const next = text;
    const dur = readCssMs(el, "--text-swap-dur", 150);

    setPhase("exit");
    const t1 = window.setTimeout(() => {
      setDisplay(next);
      prevRef.current = next;
      setPhase("enter-start");
      requestAnimationFrame(() => {
        forceReflow(el);
        setPhase("idle");
        runningRef.current = false;
      });
    }, dur);

    return () => {
      window.clearTimeout(t1);
      runningRef.current = false;
    };
  }, [text]);

  const phaseClass =
    phase === "exit" ? " is-exit" : phase === "enter-start" ? " is-enter-start" : "";

  return (
    <Tag
      ref={ref as React.RefObject<never>}
      className={`t-text-swap${phaseClass}${className ? ` ${className}` : ""}`}
      style={style}
    >
      {display}
    </Tag>
  );
}
