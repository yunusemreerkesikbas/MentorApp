"use client";

import { useState, type CSSProperties, type ReactNode } from "react";

/**
 * Which of the three desk things is picked. A numbered pin on the scene and its paper note light
 * up together. Below `lg` the notes become one at a time behind three tabs; all three stay in the
 * DOM. The scene and the notes are server-rendered and passed in.
 */

export interface DeskItem {
  /** The note's plate name; also the pin's accessible name. */
  name: string;
  tab: string;
  /** Where the pin sits, in stage units (1040 × 520). */
  pin: { x: number; y: number };
  paper?: "lined" | "grid";
  tilt: string;
  tape: string;
  note: ReactNode;
}

export function DeskPicker({ scene, items }: { scene: ReactNode; items: DeskItem[] }) {
  const [active, setActive] = useState(0);
  const on = (i: number) => (i === active ? " is-on" : "");

  return (
    <>
      <div className="ld-frame">
        <div className="ld-stage">
          {scene}
          {items.map((item, i) => (
            <button
              key={item.name}
              type="button"
              className={`ld-pin${on(i)}`}
              style={{ "--x": item.pin.x, "--y": item.pin.y } as CSSProperties}
              aria-pressed={i === active}
              aria-label={item.name}
              onClick={() => setActive(i)}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>

      <div className="ld-tabs">
        {items.map((item, i) => (
          <button key={item.name} type="button" className={`ld-tab${on(i)}`} aria-pressed={i === active} onClick={() => setActive(i)}>
            {item.tab}
          </button>
        ))}
      </div>

      <div className="ld-notes">
        {items.map((item, i) => (
          <article
            key={item.name}
            className={`ld-note${item.paper ? ` is-${item.paper}` : ""}${on(i)}`}
            style={{ "--tilt": item.tilt, "--tape": item.tape } as CSSProperties}
          >
            <i className="ld-tape" aria-hidden="true" />
            <p className="ld-plate">
              <b>{i + 1}</b>
              <span>{item.name}</span>
            </p>
            {item.note}
          </article>
        ))}
      </div>
    </>
  );
}
