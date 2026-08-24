"use client";

import Image from "next/image";
import { useState } from "react";
import type { AchievementId } from "@mentor/types";

const FALLBACK_SRC = "/mascot/puhu/puhu-default.png";

export function AchievementArt({
  artKey,
  alt,
  priority = false,
  className,
  sizes = "(max-width: 640px) 42vw, 180px",
}: {
  artKey: AchievementId;
  alt: string;
  priority?: boolean;
  className?: string;
  sizes?: string;
}) {
  const [failedArtKey, setFailedArtKey] = useState<AchievementId | null>(null);
  const failed = failedArtKey === artKey;

  return (
    <Image
      src={failed ? FALLBACK_SRC : `/achievements/puhu/${artKey}.webp`}
      alt={alt}
      width={1024}
      height={1024}
      sizes={sizes}
      priority={priority}
      onError={() => setFailedArtKey(artKey)}
      className={className}
    />
  );
}
