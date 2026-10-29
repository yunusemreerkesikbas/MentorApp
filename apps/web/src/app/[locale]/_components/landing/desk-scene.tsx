import { DeskBoard, type DeskBoardCopy } from "./desk-board";
import { DeskObjects, DeskWall, DeskWood, at } from "./desk-room";
import { StoryPhone, type StoryCopy } from "./desk-story";
import { SceneImg } from "./scene-img";

/**
 * The whole "Sabah masası" stage: the vector desk, then everything that carries words, drawn as
 * the app draws it. Puhu's bubble, the notebook covers and the sticky note use the app's own
 * strings, so the English page shows the English app.
 */

export interface DeskSceneCopy {
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

export function DeskScene({ copy }: { copy: DeskSceneCopy }) {
  return (
    <div className="ld-scene" aria-hidden="true">
      <DeskWall />
      <DeskWood />
      <DeskObjects />

      {/* Puhu reading on his book stack (the Defterlerim sprite, feet included). */}
      <SceneImg src="/visuals/landing/desk-puhu.webp" loading="lazy" className="ld-at" style={at(211, 84, 90.5, 96.5)} />
      <p className="ld-at ld-bubble" style={at(166, 8, 232)}>
        {copy.bubble}
      </p>

      <div className="ld-at ld-wallboard" style={at(680, 38, 180)}>
        <DeskBoard {...copy.board} />
      </div>

      {/* A notebook still in its parcel; outside the phone crop, so desktop only. */}
      <div className="ld-at ld-parcel" style={at(40, 304, 112, 146)}>
        <span className="ld-parcel-tag">{copy.newNotebook}</span>
      </div>

      <div className="ld-at ld-book is-navy" style={at(230, 268, 160, 210)}>
        <i className="ld-book-tab is-blue" />
        <i className="ld-book-tab is-green" />
        <span className="ld-book-label">
          <b className="is-print">{copy.mistakeTitle}</b>
          <small>{copy.mistakePages}</small>
        </span>
        <span className="ld-book-sticky">{copy.due}</span>
        <i className="ld-book-ribbon" />
      </div>

      <div className="ld-at ld-book is-grey" style={at(420, 282, 146, 196)}>
        <span className="ld-book-tape">{copy.mathTape}</span>
        <span className="ld-book-label">
          <b>{copy.mathTitle}</b>
          <small>{copy.mathPages}</small>
        </span>
      </div>

      <StoryPhone copy={copy.story} />
    </div>
  );
}
