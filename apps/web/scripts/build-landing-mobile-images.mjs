import sharp from "sharp";
import { fileURLToPath } from "node:url";

// Background layers only: the facade keeps its original 1024×1536 detail for the window close-ups.
const directory = new URL("../public/visuals/landing/", import.meta.url);
for (const layer of ["far", "mid", "front"]) {
  const source = fileURLToPath(new URL(`city-${layer}.webp`, directory));
  for (const format of ["avif", "webp"]) {
    const output = fileURLToPath(new URL(`city-${layer}-mobile.${format}`, directory));
    const options = format === "avif" ? { quality: 50, effort: 6 } : { quality: 65 };
    await sharp(source).resize({ width: 1024 }).toFormat(format, options).toFile(output);
  }
}

const facadeSource = fileURLToPath(new URL("city-facade.webp", directory));
const facadeAvif = fileURLToPath(new URL("city-facade.avif", directory));
await sharp(facadeSource).avif({ quality: 50, effort: 6 }).toFile(facadeAvif);
