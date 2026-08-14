import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const COMPONENT_DIR = dirname(fileURLToPath(import.meta.url));

describe("shared post media layout", () => {
  it("keeps single media at its natural ratio and frames each media item", () => {
    const gallery = readFileSync(resolve(COMPONENT_DIR, "attachment-gallery.tsx"), "utf8");

    expect(gallery).toContain('"mt-3 grid w-full');
    expect(gallery).toContain("h-auto w-full");
    expect(gallery).not.toContain("grid aspect-[16/9]");
    expect(gallery).toContain("cursor-pointer overflow-hidden rounded-[30px] border border-black/20");
    expect(gallery).not.toContain("grid w-full grid-cols-1 overflow-hidden rounded-[30px] border");
    expect(gallery).not.toContain("overscroll-x-contain rounded-[30px] border");
  });

  it("uses a ten pixel gap for multi-image media", () => {
    const gallery = readFileSync(resolve(COMPONENT_DIR, "attachment-gallery.tsx"), "utf8");

    expect(gallery).toContain("gap-2.5");
    expect(gallery).not.toContain("gap-1 overscroll-x-contain");
  });

  it("animates lightbox entrance and exit with a reduced-motion path", () => {
    const gallery = readFileSync(resolve(COMPONENT_DIR, "attachment-gallery.tsx"), "utf8");

    expect(gallery).toContain("AnimatePresence");
    expect(gallery).toContain("useReducedMotion");
    expect(gallery).toContain("initial={reduceMotion ? false : { opacity: 0 }}");
    expect(gallery).toContain("exit={reduceMotion ? { opacity: 0 } : { opacity: 0 }}");
    expect(gallery).toContain("scale: 0.96, y: 8");
    expect(gallery).toContain("duration: reduceMotion ? 0 : 0.2");
  });
});
