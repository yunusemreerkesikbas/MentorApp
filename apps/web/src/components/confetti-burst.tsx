"use client";

import { useEffect, useState } from "react";
import {
  DotLottieReact,
  type DotLottie,
} from "@lottiefiles/dotlottie-react";

export function ConfettiBurst({ onComplete }: { onComplete: () => void }) {
  const [player, setPlayer] = useState<DotLottie | null>(null);

  useEffect(() => {
    if (!player) return;

    const finish = () => onComplete();
    player.addEventListener("complete", finish);
    player.addEventListener("loadError", finish);
    player.addEventListener("renderError", finish);

    return () => {
      player.removeEventListener("complete", finish);
      player.removeEventListener("loadError", finish);
      player.removeEventListener("renderError", finish);
    };
  }, [onComplete, player]);

  return (
    <DotLottieReact
      aria-hidden
      autoplay
      loop={false}
      src="/lottie/confetti.lottie"
      dotLottieRefCallback={setPlayer}
      className="size-full bg-transparent"
      renderConfig={{ autoResize: true, devicePixelRatio: 1.5 }}
    />
  );
}
