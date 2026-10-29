"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";

/**
 * Which of the three desk things is picked. A numbered pin on the scene and its paper note light
 * up together. Below `lg` the notes become one at a time behind three tabs; all three stay in the
 * DOM. The scene and the notes are server-rendered and passed in.
 *
 * It also pushes the goal board, which swings about its nail the way the panel's hung board does
 * (`hung-board-sway.ts`): once when the scene comes into view, when a mouse comes over the board,
 * and when its pin is picked. The swing itself is CSS (`.lm-swing`); a push only sets its size and
 * flips `data-sway` so the animation starts again.
 */

/** First-swing angles, the panel's pushes divided out: arrival about 3°, a mouse or a pick 1.5°. */
const SWAY = { arrival: 2.8, nudge: 1.5 };

export interface MorningItem {
  /** The note's plate name; also the pin's accessible name. */
  name: string;
  tab: string;
  /** Where the pin sits, in stage units (1040 × 520). */
  pin: { x: number; y: number };
  paper?: "lined" | "grid";
  tilt: string;
  tape: string;
  note: ReactNode;
  /** Picking this one pushes the goal board. */
  swaysBoard?: boolean;
}

export function MorningPicker({ scene, items }: { scene: ReactNode; items: MorningItem[] }) {
  const [active, setActive] = useState(0);
  const [sway, setSway] = useState<{ count: number; deg: number } | null>(null);
  const frame = useRef<HTMLDivElement>(null);
  const on = (i: number) => (i === active ? " is-on" : "");
  const push = (deg: number) => setSway((last) => ({ count: (last?.count ?? 0) + 1, deg }));

  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        setSway((last) => last ?? { count: 0, deg: SWAY.arrival });
      },
      { threshold: 0.6 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  /** A mouse coming over the board pushes it away from the side it came in on. */
  const handlePointerOver = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" || !(event.target instanceof Element)) return;
    const board = event.target.closest(".lm-wallboard");
    if (!board || (event.relatedTarget instanceof Node && board.contains(event.relatedTarget))) return;
    const box = board.getBoundingClientRect();
    push(event.clientX < box.left + box.width / 2 ? -SWAY.nudge : SWAY.nudge);
  };

  return (
    <>
      <div className="lm-frame" ref={frame}>
        <div
          className="lm-stage"
          data-sway={sway ? sway.count % 2 : undefined}
          style={sway ? ({ "--sway": `${sway.deg}deg` } as CSSProperties) : undefined}
          onPointerOver={handlePointerOver}
        >
          {scene}
          {items.map((item, i) => (
            <button
              key={item.name}
              type="button"
              className={`lm-pin${on(i)}`}
              style={{ "--x": item.pin.x, "--y": item.pin.y } as CSSProperties}
              aria-pressed={i === active}
              aria-label={item.name}
              onClick={() => {
                setActive(i);
                if (item.swaysBoard) push(SWAY.nudge);
              }}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>

      <div className="lm-tabs">
        {items.map((item, i) => (
          <button key={item.name} type="button" className={`lm-tab${on(i)}`} aria-pressed={i === active} onClick={() => setActive(i)}>
            {item.tab}
          </button>
        ))}
      </div>

      <div className="lm-notes">
        {items.map((item, i) => (
          <article
            key={item.name}
            className={`lm-note${item.paper ? ` is-${item.paper}` : ""}${on(i)}`}
            style={{ "--tilt": item.tilt, "--tape": item.tape } as CSSProperties}
          >
            <i className="lm-tape" aria-hidden="true" />
            <p className="lm-plate">
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
