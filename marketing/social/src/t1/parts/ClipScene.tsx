import { Video } from "@remotion/media";
import { staticFile } from "remotion";
import { CLIP_SCALE, rate, sourceFrames, type Cut } from "../timeline";

// A clip full screen, one muted <Video> per cut. Scaled from the top centre so the KlingAI mark (bottom right)
// falls off the frame. The chest clip (mark already cropped) passes scale 1 and a `top` that leaves the night strip.
export function ClipScene({ name, src, cuts, scale = CLIP_SCALE, top = 0 }: { name: string; src: string; cuts: Cut[]; scale?: number; top?: number }) {
  return (
    <div style={{ position: "absolute", left: 0, top, width: 1080, height: 1920, transformOrigin: "50% 0%", scale: String(scale) }}>
      {cuts.map((c, i) => (
        <Video
          key={c.at}
          name={cuts.length > 1 ? `${name} ${i + 1}` : name}
          src={staticFile(src)}
          from={c.at}
          durationInFrames={sourceFrames(c)}
          trimBefore={Math.round(c.clipStart * 30)}
          playbackRate={rate(c)}
          muted
          objectFit="cover"
          style={{ width: 1080, height: 1920 }}
        />
      ))}
    </div>
  );
}
