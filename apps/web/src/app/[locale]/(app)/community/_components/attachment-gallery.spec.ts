import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const COMPONENT_DIR = dirname(fileURLToPath(import.meta.url));

describe("attachment gallery responsive contract", () => {
  it("shows 1.25 swipeable slides on mobile and restores the media grid on desktop", () => {
    const gallery = readFileSync(resolve(COMPONENT_DIR, "attachment-gallery.tsx"), "utf8");

    expect(gallery).toContain("snap-x snap-mandatory overflow-x-auto");
    expect(gallery).toContain("w-4/5 shrink-0 snap-start");
    expect(gallery).toContain("md:grid md:aspect-[16/9]");
    expect(gallery).toContain("md:w-full md:shrink md:[scroll-snap-align:none]");
  });
});
