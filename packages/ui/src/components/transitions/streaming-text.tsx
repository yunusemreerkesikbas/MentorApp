"use client";

import { useEffect, useRef, useState } from "react";

import { prefersReducedMotion, readCssMs } from "./motion-utils.js";

export interface StreamingTextProps {
  text: string;
  className?: string;
}

/** Resolves a complete sentence word by word through a soft cross-blur. */
export function StreamingText({ text, className }: StreamingTextProps) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const words = text.trim().split(/\s+/).filter(Boolean);
  const [stream, setStream] = useState({ text, visibleWords: 0 });
  const visibleWords = stream.text === text ? stream.visibleWords : 0;

  useEffect(() => {
    const root = rootRef.current;
    let timer = 0;
    let frame = 0;
    let cancelled = false;

    if (!root || words.length === 0 || prefersReducedMotion()) {
      setStream({ text, visibleWords: words.length });
      return;
    }

    setStream({ text, visibleWords: 0 });
    const gap = readCssMs(root, "--stream-gap", 60);

    frame = window.requestAnimationFrame(() => {
      let nextWord = 1;
      const revealNext = () => {
        if (cancelled) return;
        setStream({ text, visibleWords: nextWord });
        if (nextWord >= words.length) return;
        nextWord += 1;
        timer = window.setTimeout(revealNext, gap);
      };
      revealNext();
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [text, words.length]);

  return (
    <span ref={rootRef} className={`t-stream${className ? ` ${className}` : ""}`}>
      {words.map((word, index) => (
        <span key={`${word}-${index}`} className={`t-stream-w${index < visibleWords ? " is-in" : ""}`}>
          {word}
          {index < words.length - 1 ? " " : ""}
        </span>
      ))}
    </span>
  );
}
