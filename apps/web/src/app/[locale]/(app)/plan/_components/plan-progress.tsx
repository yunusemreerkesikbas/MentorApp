"use client";

import { useEffect, useState, type CSSProperties } from "react";

/** Plan page progress — 8px track (Stitch mock), DESIGN.md token colors. */
export function PlanProgress({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const clamped = Math.min(100, Math.max(0, value));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const ratio = ready ? clamped / 100 : 0;

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={`h-2 w-full overflow-hidden rounded-full ${className ?? ""}`}
      style={{ backgroundColor: "var(--color-progress-track)" }}
    >
      <div
        className="mentor-plan-progress-fill"
        style={{ "--plan-progress-ratio": ratio } as CSSProperties}
      />
    </div>
  );
}
