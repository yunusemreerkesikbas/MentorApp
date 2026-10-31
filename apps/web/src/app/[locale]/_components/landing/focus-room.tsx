"use client";

import Image from "next/image";
import { useRef, useState, type ReactNode } from "react";
import type { StudyRoomTheme } from "@mentor/types";
import { usePaperFlutter } from "./paper-flutter";

/**
 * The session page as it opens, in one of its own rooms: the room tabs swap the backdrop (all three
 * stay mounted so a switch never waits on a fetch), and the controls on top follow the room's light.
 * The notes below are passed in; `data-room` on the wrapper lets the table note show the same room.
 */

export interface FocusRoomTheme {
  id: StudyRoomTheme;
  label: string;
  backdrop: string;
  /** Ev is a light room: the controls turn to dark ink on frosted white. */
  light: boolean;
}

export interface FocusSceneCopy {
  subject: string;
  ambient: string;
  task: string;
  minutes: number;
  unit: string;
  presets: [string, string, string];
  summary: ReactNode;
  start: string;
}

const RING = 2 * Math.PI * 84;

export function FocusRoom({
  themes,
  scene,
  tabsLabel,
  children,
}: {
  themes: FocusRoomTheme[];
  scene: FocusSceneCopy;
  tabsLabel: string;
  children: ReactNode;
}) {
  const [active, setActive] = useState<StudyRoomTheme>(themes[0]!.id);
  const root = useRef<HTMLDivElement>(null);
  usePaperFlutter(root);
  const theme = themes.find((item) => item.id === active) ?? themes[0]!;
  // The dial reads a 50-minute focus out of 120, like the session page's own ring.
  const arc = (scene.minutes / 120) * RING;
  const knob = (scene.minutes / 120) * 2 * Math.PI;

  return (
    <div className="lf-room" data-room={active} ref={root}>
      <div className="lf-tabs" role="group" aria-label={tabsLabel}>
        {themes.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`lf-tab${item.id === active ? " is-on" : ""}`}
            aria-pressed={item.id === active}
            onClick={() => setActive(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className={`lf-scene${theme.light ? " is-light" : ""}`}>
        {themes.map((item) => (
          <Image
            key={item.id}
            src={item.backdrop}
            alt=""
            fill
            sizes="(min-width: 1152px) 1072px, 100vw"
            className={`lf-backdrop${item.id === active ? " is-on" : ""}`}
          />
        ))}
        <div className="lf-ui" aria-hidden="true">
          <div className="lf-bar">
            <span>{scene.subject} ▾</span>
            <i />
            <span>‹&nbsp; {theme.label} &nbsp;›</span>
            <i />
            <span>♪ {scene.ambient} ▾</span>
          </div>
          <p className="lf-task">{scene.task}</p>
          <svg className="lf-ring" viewBox="0 0 200 200">
            <circle cx="100" cy="100" r="84" fill="none" stroke="var(--lf-line)" strokeWidth="6" />
            <circle
              cx="100"
              cy="100"
              r="84"
              fill="none"
              stroke="#55acee"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${arc} ${RING}`}
              transform="rotate(-90 100 100)"
            />
            <circle cx={100 + 84 * Math.sin(knob)} cy={100 - 84 * Math.cos(knob)} r="9" fill="var(--lf-knob)" stroke="#ffffff" strokeWidth="2.5" />
            <text x="100" y="110" textAnchor="middle" fontWeight="900" fontSize="56" fill="currentColor">
              {scene.minutes}
            </text>
            <text x="100" y="132" textAnchor="middle" fontWeight="700" fontSize="12" fill="currentColor" opacity=".8">
              {scene.unit}
            </text>
          </svg>
          <div className="lf-steps">
            <span>−</span>
            <span>+</span>
          </div>
          <div className="lf-presets">
            {scene.presets.map((preset, i) => (
              <span key={preset} className={i === 2 ? "is-on" : undefined}>
                {preset}
              </span>
            ))}
          </div>
          <p className="lf-summary">{scene.summary}</p>
          <span className="lf-start">{scene.start}</span>
        </div>
      </div>

      {children}
    </div>
  );
}
