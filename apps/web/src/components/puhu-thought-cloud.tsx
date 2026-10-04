import type { ReactNode } from "react";
import "./puhu-thought-cloud.css";

export function PuhuSpeechBubble({ children }: { children: ReactNode }) {
  return (
    <div className="puhu-speech-bubble">
      <svg
        className="puhu-speech-bubble__cloud"
        viewBox="0 0 400 280"
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        <path
          vectorEffect="non-scaling-stroke"
          d="M 48 76 C 24 36 76 8 120 26 C 151 -4 202 -2 228 24 C 276 0 330 18 338 56 C 384 54 408 98 384 132 C 410 166 390 210 352 216 C 350 258 294 278 252 258 C 218 282 158 282 130 258 C 84 276 36 252 40 216 C 0 208 -8 162 18 140 C -4 108 10 80 48 76 Z"
        />
      </svg>
      <div className="puhu-speech-bubble__panel">{children}</div>
      <span className="puhu-speech-bubble__trail" aria-hidden="true" />
    </div>
  );
}
