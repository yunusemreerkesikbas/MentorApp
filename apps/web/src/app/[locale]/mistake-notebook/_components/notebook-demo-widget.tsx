"use client";

import { useEffect, useState } from "react";
import { LEDGE, LEDGE_FILLED } from "@/components/panel/panel-styles";
import { SeoSignupCta } from "@/components/seo-lp/seo-signup-cta";
import { trackSeoLpEvent } from "@/lib/analytics";
import { recordSeoLpSource } from "@/lib/lp-attribution";

export interface NotebookDemoCopy {
  pill: string;
  badge: string;
  subject: string;
  question: string;
  options: string;
  note: string;
  prompt: string;
  btnMissed: string;
  btnSolved: string;
  feedbackMissed: string;
  feedbackSolved: string;
  cta: string;
}

export function NotebookDemoWidget({ copy }: { copy: NotebookDemoCopy }) {
  const [outcome, setOutcome] = useState<"missed" | "solved" | null>(null);

  useEffect(() => {
    recordSeoLpSource("notebook");
    trackSeoLpEvent("notebook_demo_view", { page_type: "mistake_notebook" });
  }, []);

  return (
    <div className="mt-8 rounded-[var(--radius-card)] border border-[var(--landing-paper-line)] bg-[var(--color-surface)] p-5 shadow-sm sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex min-h-7 items-center rounded-full bg-[var(--landing-pill)] px-3 text-xs font-extrabold text-[var(--landing-pill-ink)]">
          {copy.pill}
        </span>
        <span className="text-xs font-bold text-[var(--landing-ink-soft)]">{copy.badge}</span>
      </div>

      <div className="mt-4 rounded-xl border border-[var(--landing-paper-line)] bg-[var(--landing-paper)] p-5">
        <span className="inline-flex rounded-md bg-[var(--color-surface)] px-2.5 py-1 text-xs font-extrabold text-[var(--landing-ink)]">
          {copy.subject}
        </span>
        <p className="mt-3 text-lg font-black text-[var(--landing-ink)]">{copy.question}</p>
        <p className="mt-2 font-mono text-sm font-bold text-[var(--landing-ink-soft)]">{copy.options}</p>
        <p className="mt-3 border-t border-[var(--landing-paper-line)] pt-3 text-sm font-semibold text-[var(--landing-ink)]">
          {copy.note}
        </p>
      </div>

      <div className="mt-5">
        <p className="text-sm font-extrabold text-[var(--landing-ink)]">{copy.prompt}</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <button
            type="button"
            aria-pressed={outcome === "missed"}
            onClick={() => setOutcome("missed")}
            className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-[var(--play-radius)] border-2 px-5 text-sm font-extrabold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] ${
              outcome === "missed"
                ? "border-transparent bg-[var(--landing-ink)] text-[var(--landing-paper)]"
                : "border-[var(--landing-paper-line)] bg-transparent text-[var(--landing-ink)]"
            }`}
          >
            ✕ {copy.btnMissed}
          </button>
          <button
            type="button"
            aria-pressed={outcome === "solved"}
            onClick={() => setOutcome("solved")}
            className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-[var(--play-radius)] border-2 px-5 text-sm font-extrabold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] ${
              outcome === "solved"
                ? "border-transparent bg-[var(--landing-ink)] text-[var(--landing-paper)]"
                : "border-[var(--landing-paper-line)] bg-transparent text-[var(--landing-ink)]"
            }`}
          >
            ✓ {copy.btnSolved}
          </button>
        </div>

        {outcome ? (
          <div className="mt-4 rounded-xl border border-[var(--landing-paper-line)] bg-[var(--landing-paper)] p-4">
            <p className="text-sm font-semibold leading-relaxed text-[var(--landing-ink)]">
              {outcome === "solved" ? copy.feedbackSolved : copy.feedbackMissed}
            </p>
            <div className="mt-4">
              <SeoSignupCta
                source="notebook"
                location="demo"
                className={`${LEDGE} ${LEDGE_FILLED} max-sm:w-full`}
              >
                {copy.cta}
              </SeoSignupCta>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
