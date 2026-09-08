import type { ReactNode } from "react";
import "./puhu-thought-cloud.css";

export function PuhuSpeechBubble({ children }: { children: ReactNode }) {
  return (
    <div className="puhu-speech-bubble">
      <div className="puhu-speech-bubble__panel">{children}</div>
      <span className="puhu-speech-bubble__tail" aria-hidden="true" />
    </div>
  );
}
