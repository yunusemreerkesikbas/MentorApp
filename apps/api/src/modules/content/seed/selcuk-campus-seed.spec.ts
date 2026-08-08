import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("Selcuk campus seed", () => {
  it("validates the five-stop pilot before touching the database", () => {
    const scriptPath = resolve(process.cwd(), "scripts/seed-selcuk-campus.mjs");
    const result = spawnSync(process.execPath, [scriptPath, "--validate-only"], {
      encoding: "utf8",
    });

    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      universitySlug: "selcuk-universitesi",
      coverageStatus: "TERRAIN_ONLY",
      renderMode: "HYBRID",
      poiCount: 5,
      minimumPoiRange: 650,
      positions: [1, 2, 3, 4, 5],
      slugs: [
        "alaeddin-keykubat-main-entrance",
        "erol-gungor-library",
        "sultan-alparslan-cultural-center",
        "technology-faculty",
        "economics-administrative-sciences-faculty",
      ],
    });
  });
});
