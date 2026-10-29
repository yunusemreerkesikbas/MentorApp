import { DeskBoard, type DeskBoardCopy } from "./desk-board";
import { DeskObjects, DeskWall, DeskWood, at } from "./desk-room";
import { StoryPhone, type StoryCopy } from "./morning-story";
import { SceneImg } from "./scene-img";

/**
 * The whole "Sabah masası" stage: the vector desk, then everything that carries words, drawn as
 * the app draws it. Puhu's bubble, the notebook covers and the sticky note use the app's own
 * strings, so the English page shows the English app.
 */

export interface MorningSceneCopy {
  bubble: string;
  mistakeTitle: string;
  mistakePages: string;
  due: string;
  mathTitle: string;
  mathPages: string;
  mathTape: string;
  newNotebook: string;
  board: DeskBoardCopy;
  story: StoryCopy;
}

const PUHU_FRAMES = ["left", "right", "blink", "foot-left", "foot-right"] as const;

export function MorningScene({ copy }: { copy: MorningSceneCopy }) {
  return (
    <div className="lm-scene" aria-hidden="true">
      <DeskWall />
      <DeskWood />
      <DeskObjects />

      {/*
        Puhu reading on his book stack, as on Defterlerim: his eyes go down the left page, then the
        right, a blink carries them back; his feet swing. The Defterlerim sprites, all on one canvas.
      */}
      <div className="lm-at lm-puhu" style={at(211, 84, 90.5, 96.5)}>
        {PUHU_FRAMES.map((frame) => (
          <SceneImg key={frame} src={`/visuals/landing/desk-puhu-${frame}.webp`} loading="lazy" className={`lm-puhu-${frame}`} />
        ))}
      </div>
      <p className="lm-at lm-bubble">
        {copy.bubble}
      </p>

      {/* The goal board with its cord and nail, so it can swing about the nail. */}
      <div className="lm-at lm-wallboard" style={at(680, 8, 180)}>
        <div className="lm-swing">
          <svg viewBox="0 0 180 32" className="lm-wall-cord">
            <path d="M12 32 90 6 168 32" fill="none" stroke="#9b7b55" strokeWidth="1.6" strokeLinejoin="round" />
            <circle cx="90" cy="6" r="3.4" fill="#8a6a4f" />
          </svg>
          <DeskBoard {...copy.board} />
        </div>
      </div>

      {/* A notebook still in its parcel; outside the phone crop, so desktop only. */}
      <div className="lm-at lm-parcel" style={at(40, 304, 112, 146)}>
        <span className="lm-parcel-tag">{copy.newNotebook}</span>
      </div>

      <div className="lm-at lm-book is-navy" style={at(230, 268, 160, 210)}>
        <i className="lm-book-tab is-blue" />
        <i className="lm-book-tab is-green" />
        <span className="lm-book-label">
          <b className="is-print">{copy.mistakeTitle}</b>
          <small>{copy.mistakePages}</small>
        </span>
        <span className="lm-book-sticky">{copy.due}</span>
        <i className="lm-book-ribbon" />
      </div>

      <div className="lm-at lm-book is-grey" style={at(420, 282, 146, 196)}>
        <span className="lm-book-tape">{copy.mathTape}</span>
        <span className="lm-book-label">
          <b>{copy.mathTitle}</b>
          <small>{copy.mathPages}</small>
        </span>
      </div>

      <StoryPhone copy={copy.story} />
    </div>
  );
}
