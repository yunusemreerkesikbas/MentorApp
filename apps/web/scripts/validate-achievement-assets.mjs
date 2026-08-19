import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const ids = [
  "first_step", "route_drawn", "dream_space_created", "rhythm_found",
  "rhythm_kept", "returned_to_path", "route_renewed", "starting_point_set",
  "mistake_revisited", "week_reflected", "first_hello", "helped_someone",
];

function inspectWebp(buffer) {
  if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WEBP") {
    throw new Error("not a WebP file");
  }
  let offset = 12;
  let dimensions = null;
  let hasAlpha = false;
  while (offset + 8 <= buffer.length) {
    const type = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const data = offset + 8;
    if (type === "VP8X") {
      hasAlpha ||= (buffer[data] & 0x10) !== 0;
      dimensions = {
        width: 1 + buffer.readUIntLE(data + 4, 3),
        height: 1 + buffer.readUIntLE(data + 7, 3),
      };
    } else if (type === "ALPH") {
      hasAlpha = true;
    } else if (type === "VP8 " && !dimensions) {
      dimensions = {
        width: buffer.readUInt16LE(data + 6) & 0x3fff,
        height: buffer.readUInt16LE(data + 8) & 0x3fff,
      };
    } else if (type === "VP8L" && !dimensions) {
      const bits = buffer.readUInt32LE(data + 1);
      dimensions = { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
      hasAlpha = true;
    }
    offset = data + size + (size % 2);
  }
  return { dimensions, hasAlpha };
}

const directory = resolve(process.cwd(), "public/achievements/puhu");
const errors = [];
for (const id of ids) {
  try {
    const result = inspectWebp(await readFile(resolve(directory, `${id}.webp`)));
    if (result.dimensions?.width !== 1024 || result.dimensions?.height !== 1024) {
      errors.push(`${id}.webp must be 1024x1024`);
    }
    if (!result.hasAlpha) errors.push(`${id}.webp must include an alpha channel`);
  } catch (error) {
    errors.push(`${id}.webp: ${error instanceof Error ? error.message : String(error)}`);
  }
}
if (errors.length > 0) {
  process.stderr.write(`Achievement asset validation failed:\n- ${errors.join("\n- ")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write("All 12 achievement assets are valid.\n");
}
