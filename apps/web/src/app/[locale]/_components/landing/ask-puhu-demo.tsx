"use client";

import { useState } from "react";

export interface AskPuhuFeeling {
  chip: string;
  reply: string;
  step: string;
}

/**
 * "Puhu'ya sor" on the coach's note: pick a feeling, read how the coach would answer. Canned on
 * purpose, no live AI here: the landing is free and public, and the AI coach is Premium.
 */
export function AskPuhuDemo({
  feelings,
  groupLabel,
  empty,
  note,
}: {
  feelings: AskPuhuFeeling[];
  groupLabel: string;
  empty: string;
  note: string;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const answer = picked === null ? null : feelings[picked];

  return (
    <>
      <div className="lc-chips" role="group" aria-label={groupLabel}>
        {feelings.map((feeling, i) => (
          <button
            key={feeling.chip}
            type="button"
            className="lc-chip"
            aria-pressed={picked === i}
            onClick={() => setPicked(i)}
          >
            {feeling.chip}
          </button>
        ))}
      </div>
      <div aria-live="polite">
        {answer ? (
          <>
            <p className="lc-reply">{answer.reply}</p>
            <p className="lc-step">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
              {answer.step}
            </p>
          </>
        ) : (
          <p className="lc-reply is-empty">{empty}</p>
        )}
      </div>
      <p className="lc-quiet">{note}</p>
    </>
  );
}
