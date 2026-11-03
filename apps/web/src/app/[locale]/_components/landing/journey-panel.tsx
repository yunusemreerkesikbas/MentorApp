"use client";

import { useState, type ReactNode } from "react";

/** The journey's right card: "Seviye" (the lights) and "Coin" (the wallet), one tab at a time. */
export function JourneyPanel({ tabsLabel, tabs }: { tabsLabel: string; tabs: { label: string; body: ReactNode }[] }) {
  const [active, setActive] = useState(0);

  return (
    <div className="lj-path">
      <div className="lj-q-tabs lj-p-tabs" role="group" aria-label={tabsLabel}>
        {tabs.map((tab, i) => (
          <button key={tab.label} type="button" className={i === active ? "is-on" : undefined} aria-pressed={i === active} onClick={() => setActive(i)}>
            {tab.label}
          </button>
        ))}
      </div>
      {/* Both panes share one grid cell, so the card keeps the taller one's height on a tab switch. */}
      <div className="lj-p-panes">
        {tabs.map((tab, i) => (
          <div key={tab.label} className="lj-p-pane" data-on={i === active} aria-hidden={i !== active}>
            {tab.body}
          </div>
        ))}
      </div>
    </div>
  );
}
