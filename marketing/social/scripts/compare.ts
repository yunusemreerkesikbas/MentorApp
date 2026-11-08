import { existsSync } from "node:fs";
import sharp from "sharp";
import { diffRatio } from "../src/diff";
import { parseOnly } from "./only";

// Pieces with an approved canvas render in reference/.
const IDS = ["F1", "F2", "F3", "S1", "S2", "S3"];
const THRESHOLD = 0.03;
const DELTA = 48;

const only = parseOnly(process.argv.slice(2));
const raw = async (file: string) => new Uint8Array(await sharp(file).ensureAlpha().raw().toBuffer());

let failed = false;
let compared = 0;
for (const id of IDS.filter((i) => !only || only.has(i))) {
  const out = `out/${id}/${id}.png`;
  if (!existsSync(out)) continue;
  const ratio = diffRatio(await raw(out), await raw(`reference/${id}.png`), DELTA);
  const ok = ratio <= THRESHOLD;
  console.log(`${id} ${ratio.toFixed(4)} ${ok ? "ok" : "FAIL"}`);
  failed ||= !ok;
  compared++;
}
if (!compared) console.warn("nothing to compare: render first");
process.exit(failed ? 1 : 0);
