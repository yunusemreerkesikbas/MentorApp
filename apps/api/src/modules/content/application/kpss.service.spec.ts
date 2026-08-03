import { describe, expect, it } from "vitest";
import { KpssService } from "./kpss.service";
import type { CityPostingCountRow } from "../infrastructure/kpss.repository";

const ALL: CityPostingCountRow[] = [
  { cityCode: "06", postings: 400, quota: 900 },
  { cityCode: "42", postings: 27, quota: 32 },
];
const ENGINEERS: CityPostingCountRow[] = [{ cityCode: "06", postings: 3, quota: 4 }];

const VHKI = "33333333-3333-4333-8333-333333333333";

/** Records the filter the service hands to SQL, so we can assert on the folding and precedence. */
function makeKpssFake() {
  const filters: ({ titleId?: string; needle?: string } | undefined)[] = [];
  return {
    filters,
    countPostingsByCity: async (
      _db: unknown,
      filter?: { titleId?: string; needle?: string },
    ) => {
      filters.push(filter);
      return filter?.titleId || filter?.needle ? ENGINEERS : ALL;
    },
  };
}

describe("KpssService.getCityCounts", () => {
  it("returns every province when no term is given", async () => {
    const kpss = makeKpssFake();
    const service = new KpssService({} as never, kpss as never);

    expect(await service.getCityCounts()).toHaveLength(2);
    expect(kpss.filters).toEqual([{ titleId: undefined, needle: undefined }]);
  });

  it("narrows the provinces to what matches the term", async () => {
    const kpss = makeKpssFake();
    const service = new KpssService({} as never, kpss as never);

    const counts = await service.getCityCounts("MÜHENDİS");
    expect(counts).toEqual([{ cityCode: "06", postings: 3, quota: 4 }]);
    // Folded the same way the SQL side folds the column — "İ" must not gain a combining dot, or
    // the LIKE silently matches nothing and the map empties out.
    expect(kpss.filters).toEqual([{ titleId: undefined, needle: "muhendis" }]);
  });

  it("narrows to the chosen title by id, not by its name", async () => {
    // A chosen goal is an exact title. Matching on the name would let MÜHENDİS pull in
    // İNŞAAT MÜHENDİSİ and overstate where the user's own target is being hired.
    const kpss = makeKpssFake();
    const service = new KpssService({} as never, kpss as never);

    await service.getCityCounts(undefined, VHKI);
    expect(kpss.filters).toEqual([{ titleId: VHKI, needle: undefined }]);
  });

  it("lets a chosen title win over a half-typed search term", async () => {
    const kpss = makeKpssFake();
    const service = new KpssService({} as never, kpss as never);

    await service.getCityCounts("muh", VHKI);
    // Both reach the repository, which resolves the precedence — asserted there by the id branch
    // returning before the needle branch is ever considered.
    expect(kpss.filters).toEqual([{ titleId: VHKI, needle: "muh" }]);
  });

  it("treats a term below the search minimum as no filter", async () => {
    // A one-letter term would otherwise match nearly everything and make the pins flicker between
    // "all provinces" and "almost all" on the way to a real word.
    const kpss = makeKpssFake();
    const service = new KpssService({} as never, kpss as never);

    expect(await service.getCityCounts("m")).toHaveLength(2);
    expect(await service.getCityCounts("   ")).toHaveLength(2);
    expect(kpss.filters).toEqual([
      { titleId: undefined, needle: undefined },
      { titleId: undefined, needle: undefined },
    ]);
  });
});
