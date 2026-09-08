import type { ReactNode } from "react";
import "./puhu-thought-cloud.css";

export function PuhuThoughtCloud({ children }: { children: ReactNode }) {
  return (
    <div className="puhu-thought-cloud">
      <div className="puhu-thought-cloud__art" aria-hidden="true">
        <svg
          className="puhu-thought-cloud__svg"
          viewBox="0 0 240 150"
          preserveAspectRatio="none"
        >
          <rect
            x="48"
            y="32"
            width="144"
            height="90"
            rx="28"
            fill="var(--color-surface)"
          />
          <path
            fill="var(--color-surface)"
            d="M20 90 C8 88 6 64 20 54 C12 34 36 18 54 30 C64 10 100 6 118 26 C140 8 176 10 190 32 C214 24 234 48 222 70 C238 82 234 110 208 112 C206 132 170 142 148 126 C128 144 92 142 76 124 C52 138 22 126 20 90 Z"
          />
        </svg>
        <span className="puhu-thought-cloud__dot puhu-thought-cloud__dot--lg" />
        <span className="puhu-thought-cloud__dot puhu-thought-cloud__dot--sm" />
      </div>
      <div className="puhu-thought-cloud__content">{children}</div>
    </div>
  );
}
