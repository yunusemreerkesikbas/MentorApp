"use client";

import { useState } from "react";

/** The quests card as the profile shows it: one tab per category, a row per quest, its right. */

export interface QuestRow {
  title: string;
  progress?: string;
  reward: string;
  coin?: boolean;
  done?: boolean;
}

export interface QuestGroup {
  tab: string;
  section: string;
  progress: string;
  rows: QuestRow[];
}

export function JourneyQuests({
  title,
  tabsLabel,
  groups,
  coinNote,
}: {
  title: string;
  tabsLabel: string;
  groups: QuestGroup[];
  coinNote: string;
}) {
  const [active, setActive] = useState(0);
  const group = groups[active] ?? groups[0]!;

  return (
    <div className="lj-quests">
      <p className="lj-q-head">
        <b>{title}</b>
        <span>{group.progress}</span>
      </p>
      <div className="lj-q-tabs" role="group" aria-label={tabsLabel}>
        {groups.map((item, i) => (
          <button key={item.tab} type="button" className={i === active ? "is-on" : undefined} aria-pressed={i === active} onClick={() => setActive(i)}>
            {item.tab}
          </button>
        ))}
      </div>
      <p className="lj-q-section">{group.section}</p>
      <ul className="lj-q-rows">
        {group.rows.map((row) => (
          <li key={row.title} className={row.done ? "is-done" : undefined}>
            <i aria-hidden="true" />
            <span>{row.title}</span>
            {row.progress ? <em>{row.progress}</em> : null}
            <b className={row.coin ? "is-coin" : undefined}>{row.reward}</b>
          </li>
        ))}
      </ul>
      <p className="lj-q-coin">{coinNote}</p>
    </div>
  );
}
