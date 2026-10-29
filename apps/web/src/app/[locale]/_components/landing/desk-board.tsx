import { VISION_BOARD_CANVAS } from "@mentor/types";
import { BoardFrame } from "@/components/vision-board/board-frame";
import { cq } from "@/components/vision-board/board-item-view";
import { STICKER_ART } from "@/components/vision-board/board-stickers";
import { SceneImg } from "./scene-img";

/**
 * A filled goal board, as the vision board draws one: the app's wood frame (`BoardFrame`) and the
 * board's own 1620 × 1080 units (`cq`). The art is one baked image of the "Kolaj" template's photo
 * slots and the app's stickers on cork (`public/visuals/landing/README.md`); the goal card stays
 * text so it translates and stays sharp.
 */

const PIN = STICKER_ART.PIN;

export interface DeskBoardCopy {
  goal: string;
  city: string;
}

export function DeskBoard({ goal, city }: DeskBoardCopy) {
  return (
    <BoardFrame frame="wood">
      <div className="ld-board" style={{ aspectRatio: `${VISION_BOARD_CANVAS.width} / ${VISION_BOARD_CANVAS.height}` }}>
        <SceneImg src="/visuals/landing/desk-board.webp" loading="lazy" className="ld-board-art" />
        <div className="ld-goal" style={{ left: cq(505), top: cq(398), width: cq(610), height: cq(250), fontSize: cq(78) }}>
          <span>{goal}</span>
          <span className="ld-goal-city" style={{ fontSize: cq(42) }}>
            {PIN.kind === "path" ? (
              <svg viewBox="0 0 100 100" aria-hidden="true">
                <path d={PIN.path} fill={PIN.fill} fillRule={PIN.fillRule} />
              </svg>
            ) : null}
            {city}
          </span>
        </div>
      </div>
    </BoardFrame>
  );
}

/** The board on its nail, the way the panel's "Hedefin" card hangs it (`HungBoard`'s cord). */
export function HungDeskBoard(copy: DeskBoardCopy) {
  return (
    <div className="ld-hung">
      <svg viewBox="0 1.5 100 17.5" aria-hidden="true" className="ld-cord">
        <path d="M19 20 L50 1.5 L81 20" fill="none" stroke="#8a6a45" strokeWidth="0.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="50" cy="1.5" r="1.35" fill="#9a7440" />
      </svg>
      <DeskBoard {...copy} />
    </div>
  );
}
