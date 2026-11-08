import sharp from "sharp";
import { fileURLToPath } from "node:url";

// Background layers only: the facade keeps its original detail for the window close-ups.
const directory = new URL("../public/visuals/landing/", import.meta.url);
for (const layer of ["far", "mid", "front"]) {
  const source = fileURLToPath(new URL(`city-${layer}.webp`, directory));
  for (const format of ["avif", "webp"]) {
    const output = fileURLToPath(new URL(`city-${layer}-mobile.${format}`, directory));
    await sharp(source).resize({ width: 1024 }).toFormat(format, { quality: 65 }).toFile(output);
  }
}
