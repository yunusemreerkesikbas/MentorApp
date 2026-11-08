import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { getCompositions, openBrowser, renderMedia, renderStill } from "@remotion/renderer";
import { CAPTIONS, formatCaption } from "../src/captions";
import { COPY } from "../src/copy";
import { checkAll } from "../src/copy-check";
import { compositionIds, EXPORT_PROPS, PIECES } from "../src/pieces";
import { parseOnly } from "./only";

const only = parseOnly(process.argv.slice(2));

// Copy gate first: a banned word never reaches a render.
const problems = checkAll(COPY, CAPTIONS);
if (problems.length) {
  for (const p of problems) console.error(`${p.where}: ${p.problem}`);
  process.exit(1);
}

const root = process.cwd();
const serveUrl = await bundle({ entryPoint: path.join(root, "src/index.ts"), publicDir: path.join(root, "public") });
const inputProps = { ...EXPORT_PROPS };
const comps = await getCompositions(serveUrl, { inputProps });
const browser = await openBrowser("chrome");

try {
  for (const piece of PIECES.filter((p) => !only || only.has(p.id))) {
    const dir = path.join(root, "out", piece.id);
    const ids = compositionIds(piece);
    const found = ids.map((id) => comps.find((c) => c.id === id));
    if (found.some((c) => !c)) {
      console.warn(`${piece.id}: no composition registered, skipped`);
      continue;
    }
    mkdirSync(dir, { recursive: true });
    for (const composition of found) {
      if (!composition) continue;
      const common = { composition, serveUrl, inputProps, puppeteerInstance: browser };
      if (piece.video) {
        await renderMedia({ ...common, codec: "h264", outputLocation: path.join(dir, `${piece.id}.mp4`) });
        await renderStill({ ...common, frame: piece.video.coverFrame, output: path.join(dir, `${piece.id}-cover.png`) });
      } else {
        await renderStill({ ...common, output: path.join(dir, `${composition.id}.png`) });
      }
      console.log(`${composition.id} ok`);
    }
    const caption = CAPTIONS[piece.id];
    if (caption) writeFileSync(path.join(dir, "caption.txt"), formatCaption(caption), "utf8");
  }
} finally {
  await browser.close({ silent: true });
}
