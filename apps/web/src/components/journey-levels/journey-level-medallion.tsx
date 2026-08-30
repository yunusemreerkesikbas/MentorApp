import { Lock } from "lucide-react";
import Image from "next/image";
import type { JourneyLevelKey } from "@mentor/types";

interface JourneyLevelMedallionProps {
  levelKey: JourneyLevelKey;
  current?: boolean;
  future?: boolean;
  className?: string;
}

/**
 * Level badge artwork in a circular frame. Artwork path is derived from the level key
 * (`public/img/levels/{key}.webp`), mirroring `AchievementArt`. Locked levels stay readable
 * but desaturated behind a lock pill, matching `AchievementCollection`.
 */
export function JourneyLevelMedallion({
  levelKey,
  future = false,
  className = "size-24",
}: JourneyLevelMedallionProps) {
  return (
    <span
      data-journey-level-key={levelKey}
      className={`relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full  ${className}`}
    >
      <Image
        src={`/img/levels/${levelKey}.webp`}
        alt=""
        aria-hidden="true"
        width={384}
        height={384}
        sizes="176px"
        className={`size-full object-cover ${future ? "opacity-35 grayscale" : ""}`}
      />
      {future ? (
        <span className="absolute inset-0 grid place-items-center" aria-hidden="true">
          <span className="rounded-full bg-[var(--color-surface)] p-1.5 text-[var(--color-secondary)] shadow-[var(--shadow-card)]">
            <Lock size={16} />
          </span>
        </span>
      ) : (
        /* ponytail: one flat tint pulls 12 stock illustrations that share no palette into
           something that reads as a set. Drop it if bespoke artwork ever lands. */
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-[color-mix(in_srgb,var(--color-progress)_18%,transparent)]"
        />
      )}
    </span>
  );
}
