"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { LEDGE, LEDGE_FILLED } from "@/components/panel/panel-styles";
import { Link } from "@/i18n/navigation";
import { readLandingCareer, saveLandingCareer, type LandingCareer } from "@/lib/landing-career";

export interface CareerChoice {
  key: LandingCareer;
  label: string;
  /** What the note says once this one is picked. */
  line: string;
}

const subscribeNothing = () => () => undefined;

/**
 * "Bu pencere boş. Senin olsun mu?" The pick lights the visitor's window with that field's Puhu
 * (the scene reads `data-career` on `.lc-root`) and is kept for the onboarding field step.
 */
export function CareerPicker({
  choices,
  groupLabel,
  emptyTitle,
  emptyBody,
  litTitle,
  cta,
}: {
  choices: CareerChoice[];
  groupLabel: string;
  emptyTitle: string;
  emptyBody: string;
  litTitle: string;
  cta: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // A return visitor's earlier pick; the server and the first client render both start empty.
  const stored = useSyncExternalStore(subscribeNothing, readLandingCareer, () => null);
  const [picked, setPicked] = useState<LandingCareer | null>(null);
  const current = picked ?? stored;
  const choice = choices.find((c) => c.key === current) ?? null;

  useEffect(() => {
    const scene = ref.current?.closest<HTMLElement>(".lc-root");
    if (!scene) return;
    if (current) scene.dataset.career = current;
    else delete scene.dataset.career;
  }, [current]);

  return (
    <div ref={ref}>
      <h2>{choice ? litTitle : emptyTitle}</h2>
      <p className="max-lg:hidden">{choice ? choice.line : emptyBody}</p>
      <div className="lc-chips" role="radiogroup" aria-label={groupLabel}>
        {choices.map((c) => (
          <label key={c.key} className="lc-chip lc-key">
            <input
              type="radio"
              name="landing-career"
              value={c.key}
              checked={current === c.key}
              onChange={() => {
                setPicked(c.key);
                saveLandingCareer(c.key);
              }}
            />
            {c.label}
          </label>
        ))}
      </div>
      {choice ? (
        <div className="mt-5">
          <Link href="/welcome" className={`${LEDGE} ${LEDGE_FILLED} max-lg:w-full`}>
            {cta}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
