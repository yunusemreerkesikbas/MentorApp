"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import {
  SESSION_SHARE_CARD_SECONDS,
  SESSION_SHARE_CARD_SIZE,
  drawSessionShareCard,
  type SessionShareCardAssets,
  type SessionShareCardModel,
} from "@/lib/session-share-card";

/**
 * The card putting itself together, drawn by the same function as the PNG: what plays here is
 * exactly what gets shared. It plays once; reduced motion draws the finished card at once.
 */
export function SessionSharePreview({
  model,
  assets,
  label,
}: {
  /** Null until the day's list settles the caption. */
  model: SessionShareCardModel | null;
  /** Null while the photo and the handwriting face load: the frame shimmers. */
  assets: SessionShareCardAssets | null;
  label: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !assets || !model) return;
    // Back the canvas at device pixels and draw in the card's 1080×1920 space.
    const box = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(box.width * dpr);
    canvas.height = Math.round(box.height * dpr);
    const draw = (seconds?: number) => {
      ctx.setTransform(
        canvas.width / SESSION_SHARE_CARD_SIZE.width,
        0,
        0,
        canvas.height / SESSION_SHARE_CARD_SIZE.height,
        0,
        0,
      );
      drawSessionShareCard(ctx, model, assets, seconds);
    };
    if (reduceMotion) {
      draw();
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const seconds = (now - start) / 1000;
      draw(seconds);
      if (seconds < SESSION_SHARE_CARD_SECONDS) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [model, assets, reduceMotion]);

  return (
    <div
      className={`aspect-[9/16] h-[min(28rem,50dvh)] shrink-0 overflow-hidden rounded-[var(--radius-card)] bg-[var(--color-surface-container)] shadow-[var(--shadow-overlay)]${assets && model ? "" : " mentor-skeleton-shimmer"}`}
    >
      <canvas ref={canvasRef} role="img" aria-label={label} className="block size-full" />
    </div>
  );
}
