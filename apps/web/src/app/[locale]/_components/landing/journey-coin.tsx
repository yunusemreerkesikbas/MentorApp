"use client";

import dynamic from "next/dynamic";
import { useRef } from "react";
import { useInView, useReducedMotion } from "framer-motion";

// The player ships its own wasm; mount it only near the wallet, never during the city opening.
const DotLottieReact = dynamic(() => import("@lottiefiles/dotlottie-react").then((m) => m.DotLottieReact), { ssr: false });

/** The wallet's coin: the spinning Lottie of `CoinCelebrationVisual`, over its still frame. */
export function JourneyCoin() {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { margin: "200px" });
  const reduceMotion = Boolean(useReducedMotion());

  return (
    <span ref={ref} className="lj-coin" aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element -- the coin's still frame, an SVG */}
      <img src="/animation/coin.svg" alt="" width={240} height={240} loading="lazy" draggable={false} />
      {inView && !reduceMotion && (
        <DotLottieReact src="/animation/coin.json" autoplay loop renderConfig={{ autoResize: true, devicePixelRatio: 2 }} />
      )}

    </span>
  );
}
