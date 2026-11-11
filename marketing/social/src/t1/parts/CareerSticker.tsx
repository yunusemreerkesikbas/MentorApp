import type { CSSProperties } from "react";
import { Img, staticFile } from "remotion";
import { ART, type ArtKey } from "../../art";
import { C } from "../../brand";

// A career Puhu as an album sticker: the art's own white ground is the card, a navy name strip under it.
export function CareerSticker({ art, name, width, style }: { art: ArtKey; name: string; width: number; style?: CSSProperties }) {
  return (
    <div
      style={{
        position: "absolute",
        width,
        boxSizing: "border-box",
        padding: width * 0.04,
        background: "#FFFFFF",
        borderRadius: width * 0.09,
        boxShadow: `0 ${width * 0.03}px 0 rgba(30, 42, 90, 0.28)`,
        ...style,
      }}
    >
      <Img src={staticFile(ART[art])} alt="" style={{ display: "block", width: "100%", aspectRatio: "1 / 0.9", objectFit: "cover", objectPosition: "50% 30%", borderRadius: width * 0.06 }} />
      <div
        style={{
          marginTop: width * 0.03,
          padding: `${width * 0.03}px 0`,
          borderRadius: width * 0.05,
          background: C.t1Ink,
          color: "#FFFFFF",
          fontSize: width * 0.115,
          fontWeight: 1000,
          lineHeight: 1,
          textAlign: "center",
          whiteSpace: "nowrap",
        }}
      >
        {name}
      </div>
    </div>
  );
}
