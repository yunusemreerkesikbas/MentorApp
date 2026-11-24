import "@/app/[locale]/_components/landing/landing-morning.css";
import { DeskObjects, DeskWall, DeskWood, at } from "@/app/[locale]/_components/landing/desk-room";
import { DeskMistakeNotebook, PUHU_FRAMES } from "@/app/[locale]/_components/landing/morning-scene";
import { SceneImg } from "@/app/[locale]/_components/landing/scene-img";
import { SceneFrame } from "./seo-paper";

export interface SeoDeskCopy {
  notebook: string;
  pages: string;
  due: string;
}

/**
 * The landing's "Sabah masası" desk, smaller, as the mistake notebook page's hero: the wall, the
 * wood, Puhu reading on his book stack and the "Yanlış Defterim" with its due note. No goal board,
 * parcel, bubble or story phone. The stage is the landing's 1040 × 520 (a phone shows its middle
 * two thirds at 4:3, `landing-morning.css`). One picture for assistive tech: `label` names it.
 * Server component; the stage classes and Puhu's reading and swinging frames are the landing's own.
 */
export function SeoDeskScene({ label, copy }: { label: string; copy: SeoDeskCopy }) {
  return (
    <SceneFrame className="seo-desk" label={label}>
      <div className="lm-root">
        <div className="lm-frame">
          <div className="lm-stage">
            <div className="lm-scene" aria-hidden="true">
              <DeskWall />
              <DeskWood />
              <DeskObjects />
              <div className="lm-at lm-puhu" style={at(211, 84, 90.5, 96.5)}>
                {PUHU_FRAMES.map((frame) => (
                  <SceneImg
                    key={frame}
                    src={`/visuals/landing/desk-puhu-${frame}.webp`}
                    loading="eager"
                    className={`lm-puhu-${frame}`}
                  />
                ))}
              </div>
              <DeskMistakeNotebook title={copy.notebook} pages={copy.pages} due={copy.due} />
            </div>
          </div>
        </div>
      </div>
    </SceneFrame>
  );
}
