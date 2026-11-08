import type { FC } from "react";
import { Composition, Still } from "remotion";
import { compositionIds, PIECES, SIZES, STUDIO_PROPS, type PieceId, type PieceProps } from "./pieces";
import { F1 } from "./pieces/F1";
import { F2 } from "./pieces/F2";
import { F3 } from "./pieces/F3";
import { F4 } from "./pieces/F4";
import { F5 } from "./pieces/F5";
import { F6 } from "./pieces/F6";
import { L1 } from "./pieces/L1";
import { PF1 } from "./pieces/PF1";
import { PF2 } from "./pieces/PF2";
import { PR1 } from "./pieces/PR1";
import { PR2 } from "./pieces/PR2";
import { PS1 } from "./pieces/PS1";
import { PS2 } from "./pieces/PS2";
import { R1 } from "./pieces/R1";
import { R2 } from "./pieces/R2";
import { R3 } from "./pieces/R3";
import { S1 } from "./pieces/S1";
import { S2 } from "./pieces/S2";
import { S3 } from "./pieces/S3";
import { S4 } from "./pieces/S4";
import { X1 } from "./pieces/X1";

// Pieces that have a component so far. Missing ids are skipped by Studio and the render script.
export const COMPONENTS: Partial<Record<PieceId, FC<PieceProps>>> = { F1, F2, F3, F4, F5, F6, S1, S2, S3, S4, R1, R2, R3, X1, L1, PF1, PF2, PS1, PS2, PR1, PR2 };

export function Root() {
  return (
    <>
      {PIECES.flatMap((p) => {
        const component = COMPONENTS[p.id];
        if (!component) return [];
        const { width, height } = SIZES[p.format];
        return compositionIds(p).map((id, i) => {
          const defaultProps: PieceProps = p.cards ? { ...STUDIO_PROPS, card: i + 1 } : { ...STUDIO_PROPS };
          return p.video ? (
            <Composition key={id} id={id} component={component} width={width} height={height} fps={p.video.fps} durationInFrames={p.video.durationInFrames} defaultProps={defaultProps} />
          ) : (
            <Still key={id} id={id} component={component} width={width} height={height} defaultProps={defaultProps} />
          );
        });
      })}
    </>
  );
}
