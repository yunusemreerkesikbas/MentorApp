"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { StreamingText } from "@mentor/ui";
import { PUHU_MOTION_FRAMES } from "@/lib/onboarding-assets";

/** New question, new focus: screen readers land on the heading instead of the previous button. */
function useFocusOnChange(key: string) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, [key]);
  return ref;
}

/** Puhu asks the question: mouth moves while the words stream in, then one blink. */
export function PuhuBubble({ title, sub }: { title: string; sub?: string }) {
  const reduceMotion = useReducedMotion();
  const titleRef = useFocusOnChange(title);
  const [speaking, setSpeaking] = useState(false);
  const [mouthClosed, setMouthClosed] = useState(false);
  const [blinking, setBlinking] = useState(false);

  useEffect(() => {
    if (reduceMotion) return;
    let mouthTimer = 0;
    let speechTimer = 0;
    let blinkTimer = 0;
    const frame = window.requestAnimationFrame(() => {
      setSpeaking(true);
      setMouthClosed(true);
      mouthTimer = window.setInterval(() => setMouthClosed((value) => !value), 150);
      speechTimer = window.setTimeout(() => {
        window.clearInterval(mouthTimer);
        setSpeaking(false);
        setBlinking(true);
      }, 900);
      blinkTimer = window.setTimeout(() => setBlinking(false), 1_060);
    });
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearInterval(mouthTimer);
      window.clearTimeout(speechTimer);
      window.clearTimeout(blinkTimer);
    };
  }, [title, reduceMotion]);

  const src = blinking
    ? PUHU_MOTION_FRAMES.blink
    : speaking && mouthClosed
      ? PUHU_MOTION_FRAMES.talkClosed
      : PUHU_MOTION_FRAMES.default;

  return (
    <div className="flex items-center gap-3">
      <motion.div
        className="relative size-[5.5rem] shrink-0"
        animate={speaking && !reduceMotion ? { y: [0, -2, 0] } : { y: 0 }}
        transition={{ duration: 0.3, repeat: speaking ? 2 : 0 }}
      >
        <Image src={src} alt="" fill priority sizes="88px" className="object-contain" aria-hidden />
      </motion.div>
      <div
        className="relative min-w-0 flex-1 rounded-[var(--play-radius)] border-2 border-[var(--play-line)] bg-[var(--color-surface)] px-4 py-3"
        aria-live="polite"
      >
        <span
          aria-hidden
          className="absolute -left-[9px] top-1/2 size-3.5 -translate-y-1/2 rotate-45 border-b-2 border-l-2 border-[var(--play-line)] bg-[var(--color-surface)]"
        />
        <h1
          ref={titleRef}
          tabIndex={-1}
          className="relative text-balance text-xl font-extrabold leading-snug text-[var(--color-main)] outline-none"
        >
          <StreamingText key={title} text={title} />
        </h1>
        {sub ? (
          <p className="relative mt-1 text-pretty text-sm font-medium leading-relaxed text-[var(--color-secondary)]">{sub}</p>
        ) : null}
      </div>
    </div>
  );
}

/** Question without Puhu, for screens whose cards already carry a Puhu (field, daily goal). */
export function PlayTitle({ title, sub, center = false }: { title: string; sub?: string; center?: boolean }) {
  const titleRef = useFocusOnChange(title);
  return (
    <div className={`flex flex-col gap-1.5 ${center ? "lg:text-center" : ""}`}>
      <h1
        ref={titleRef}
        tabIndex={-1}
        className="text-balance text-2xl font-extrabold leading-tight text-[var(--color-main)] outline-none"
      >
        {title}
      </h1>
      {sub ? <p className="text-pretty text-base font-medium leading-relaxed text-[var(--color-secondary)]">{sub}</p> : null}
    </div>
  );
}
