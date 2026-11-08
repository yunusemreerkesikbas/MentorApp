import type { CSSProperties } from "react";
import { getRemotionEnvironment } from "remotion";
import { guideVisible } from "../pieces";

// Dashed box marking where the Instagram link or poll sticker goes. Studio preview only: any render
// (npm run render, Studio's Render button, the CLI) drops it, whatever `show` says.
export function LinkGuide({ show, label = "Bağlantı çıkartması buraya", style }: { show: boolean; label?: string; style?: CSSProperties }) {
  if (!guideVisible(show, getRemotionEnvironment().isRendering)) return null;
  return (
    <div style={{ boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, letterSpacing: "0.04em", ...style }}>
      {label}
    </div>
  );
}
