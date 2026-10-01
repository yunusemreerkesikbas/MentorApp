/** Development-only media render. Requires a local FFmpeg executable; never runs per student. */
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import sharp from "sharp";

const ffmpeg = process.env.FFMPEG_PATH ?? "ffmpeg";
const output = resolve("public/mascot/puhu/planning-flight");
const scratchRoot = resolve(tmpdir());
const scratch = mkdtempSync(join(scratchRoot, "puhu-flight-"));
const star = join(scratch, "star.png");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><defs><filter id="glow"><feGaussianBlur stdDeviation="7"/></filter></defs><path id="star" d="M48 22 55 40 74 42 60 55 64 74 48 64 32 74 36 55 22 42 41 40Z" fill="#FFD76A"/><use href="#star" filter="url(#glow)"/><path d="M48 28 53 42 67 44 57 53 60 66 48 59 36 66 39 53 29 44 43 42Z" fill="#fff5d5"/></svg>`;

// Smooth keyframes visit the glasses, pause, then drift away. Endpoints fade to zero for a loop.
function pathExpression(points: [number, number][]) {
  let expression = String(points.at(-1)![1]);
  for (let index = points.length - 2; index >= 0; index--) {
    const [time, value] = points[index]!;
    const [nextTime, nextValue] = points[index + 1]!;
    const phase = `max(0,min(1,(t-${time})/${nextTime - time}))`;
    const eased = `(0.5-0.5*cos(PI*${phase}))`;
    expression = `if(lt(t,${nextTime}),${value}+${nextValue - value}*${eased},${expression})`;
  }
  return expression;
}

try {
  await sharp(Buffer.from(svg)).png().toFile(star);
  for (const [name, width, height, glassesX, glassesY] of [
    ["desktop", 1920, 1080, 800, 388],
    ["mobile", 1080, 1920, 400, 786],
  ] as const) {
    const x = pathExpression([
      [0, width * 0.74],
      [2.5, width * 0.58],
      [3.8, glassesX],
      [4.7, glassesX],
      [6.8, width * 0.23],
      [8, width * 0.23],
    ]);
    const y = pathExpression([
      [0, height * 0.24],
      [2.5, height * 0.25],
      [3.8, glassesY],
      [4.7, glassesY],
      [6.8, height * 0.19],
      [8, height * 0.19],
    ]);
    const filters = [
      `[0:v]scale=${width * 2}:${height * 2},zoompan=z='1+0.018*pow(sin(PI*on/239),2)':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s=${width}x${height}:fps=30[sky]`,
      "[1:v]scale=48:48,format=rgba,fade=t=in:st=0.3:d=0.5:alpha=1,fade=t=out:st=6.8:d=0.6:alpha=1[star]",
      `[sky][star]overlay=x='${x}-24':y='${y}-24':format=auto,format=yuv420p[out]`,
    ].join(";");
    const result = spawnSync(
      ffmpeg,
      [
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-loop",
        "1",
        "-framerate",
        "30",
        "-i",
        join(output, `${name}.webp`),
        "-loop",
        "1",
        "-framerate",
        "30",
        "-i",
        star,
        "-filter_complex",
        filters,
        "-map",
        "[out]",
        "-t",
        "8",
        "-an",
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-crf",
        "24",
        "-movflags",
        "+faststart",
        join(output, `${name}.mp4`),
      ],
      { stdio: "inherit" },
    );
    if (result.error) throw result.error;
    if (result.status !== 0)
      throw new Error(`${name} video render failed (${result.status})`);
    console.log(`${name}: ${width}x${height}, 8 seconds, silent H.264 MP4`);
  }
} finally {
  if (dirname(scratch) !== scratchRoot)
    throw new Error("Unexpected media scratch path");
  rmSync(scratch, { recursive: true, force: true });
}
