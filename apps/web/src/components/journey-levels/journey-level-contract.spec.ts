import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = process.cwd();

function source(path: string) {
  return readFileSync(resolve(webRoot, path), "utf8");
}

function flattenKeys(value: unknown, prefix = ""): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    flattenKeys(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe("journey-level rendering contract", () => {
  it("uses the backend progress object on all three level surfaces", () => {
    const profile = source(
      "src/app/[locale]/(app)/community/member/[username]/_components/profile-header.tsx",
    );
    const communitySnapshot = source(
      "src/app/[locale]/(app)/community/_components/stat-snapshot.tsx",
    );
    const economyBalance = source(
      "src/app/[locale]/(app)/profile/_components/economy-balance-card.tsx",
    );
    const progressBar = source(
      "src/components/journey-levels/journey-level-progress.tsx",
    );

    expect(profile).toContain("<JourneyLevelProfile");
    expect(communitySnapshot).toContain("<JourneyLevelCompact");
    expect(economyBalance).toContain("<JourneyLevelCompact");
    expect(progressBar).toContain("progress.percent");

    for (const surface of [profile, communitySnapshot, economyBalance]) {
      expect(surface).not.toMatch(/level\.xp\s*\/\s*level\.nextAt/);
      expect(surface).not.toContain("Math.round");
    }
  });

  it("keeps Turkish and English journey-level translation keys at parity", () => {
    const tr = JSON.parse(source("messages/tr.json")) as { journey_levels: unknown };
    const en = JSON.parse(source("messages/en.json")) as { journey_levels: unknown };

    expect(flattenKeys(tr.journey_levels).toSorted()).toEqual(
      flattenKeys(en.journey_levels).toSorted(),
    );
  });
});

