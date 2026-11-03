"use client";

import dynamic from "next/dynamic";
import { useReducedMotion } from "framer-motion";

// The player ships its own wasm, so the landing loads it only on the client, after the page.
const DotLottieReact = dynamic(() => import("@lottiefiles/dotlottie-react").then((m) => m.DotLottieReact), { ssr: false });

/** The wallet's coin: the spinning Lottie of `CoinCelebrationVisual`, over its still frame. */
export function JourneyCoin() {
  const reduceMotion = Boolean(useReducedMotion());

  return (
    <span className="lj-coin" aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element -- the coin's still frame, an SVG */}
      <img src="/animation/coin.svg" alt="" width={240} height={240} draggable={false} />
      {/* Always mounted, so the server and the first client render match; reduced motion only stops it. */}
      <DotLottieReact src="/animation/coin.json" autoplay={!reduceMotion} loop={!reduceMotion} renderConfig={{ autoResize: true, devicePixelRatio: 2 }} />

    </span>
  );
}
