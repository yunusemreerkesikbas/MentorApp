import { describe, expect, it } from "vitest";
import { NotFoundError } from "../../../common/errors/domain-error";
import { KpssService } from "./kpss.service";
import type { CityPostingCountRow } from "../infrastructure/kpss.repository";

const ALL: CityPostingCountRow[] = [
  { cityCode: "06", postings: 400, quota: 900 },
  { cityCode: "42", postings: 27, quota: 32 },
];
const ENGINEERS: CityPostingCountRow[] = [{ cityCode: "06", postings: 3, quota: 4 }];

const VHKI = "33333333-3333-4333-8333-333333333333";

const CURRENT = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  kind: "KPSS_POSTINGS",
  period: "2026-1",
} as const;
const PREVIOUS = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  kind: "KPSS_POSTINGS",
  period: "2025-2",
} as const;

/** Records the filter the service hands to SQL, so we can assert on the folding and precedence. */
function makeKpssFake() {
  const filters: ({ titleId?: string; needle?: string } | undefined)[] = [];
  const scopes: string[] = [];
  return {
    filters,
    scopes,
    countPostingsByCity: async (
      _db: unknown,
      datasetId: string,
      filter?: { titleId?: string; needle?: string },
    ) => {
      scopes.push(datasetId);
      filters.push(filter);
      return filter?.titleId || filter?.needle ? ENGINEERS : ALL;
    },
  };
}

/** Stands in for `DatasetService`: only the resolution rules matter to these tests. */
function makeDatasetsFake() {
  return {
    resolve: async (_kind: string, id?: string | null) => {
      if (!id) return CURRENT;
      const row = [CURRENT, PREVIOUS].find((d) => d.id === id);
      if (!row) throw new NotFoundError({ resource: "dataset" });
      return row;
    },
    info: (row: { id: string }) => ({ id: row.id }),
  };
}

describe("KpssService.getCityCounts", () => {
  it("returns every province when no term is given", async () => {
    const kpss = makeKpssFake();
    const service = new KpssService({} as never, kpss as never, makeDatasetsFake() as never);

    expect(await service.getCityCounts()).toHaveLength(2);
    expect(kpss.filters).toEqual([{ titleId: undefined, needle: undefined }]);
  });

  it("narrows the provinces to what matches the term", async () => {
    const kpss = makeKpssFake();
    const service = new KpssService({} as never, kpss as never, makeDatasetsFake() as never);

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
    const service = new KpssService({} as never, kpss as never, makeDatasetsFake() as never);

    await service.getCityCounts(undefined, VHKI);
    expect(kpss.filters).toEqual([{ titleId: VHKI, needle: undefined }]);
  });

  it("lets a chosen title win over a half-typed search term", async () => {
    const kpss = makeKpssFake();
    const service = new KpssService({} as never, kpss as never, makeDatasetsFake() as never);

    await service.getCityCounts("muh", VHKI);
    // Both reach the repository, which resolves the precedence — asserted there by the id branch
    // returning before the needle branch is ever considered.
    expect(kpss.filters).toEqual([{ titleId: VHKI, needle: "muh" }]);
  });

  it("treats a term below the search minimum as no filter", async () => {
    // A one-letter term would otherwise match nearly everything and make the pins flicker between
    // "all provinces" and "almost all" on the way to a real word.
    const kpss = makeKpssFake();
    const service = new KpssService({} as never, kpss as never, makeDatasetsFake() as never);

    expect(await service.getCityCounts("m")).toHaveLength(2);
    expect(await service.getCityCounts("   ")).toHaveLength(2);
    expect(kpss.filters).toEqual([
      { titleId: undefined, needle: undefined },
      { titleId: undefined, needle: undefined },
    ]);
  });
});

describe("KpssService dataset scoping", () => {
  it("defaults to the current edition when no period is named", async () => {
    const kpss = makeKpssFake();
    const service = new KpssService({} as never, kpss as never, makeDatasetsFake() as never);

    await service.getCityCounts();
    expect(kpss.scopes).toEqual([CURRENT.id]);
  });

  it("scopes the counts to the requested edition", async () => {
    const kpss = makeKpssFake();
    const service = new KpssService({} as never, kpss as never, makeDatasetsFake() as never);

    await service.getCityCounts(undefined, undefined, null, PREVIOUS.id);
    // Without this the query would sum every loaded round and report double the vacancies.
    expect(kpss.scopes).toEqual([PREVIOUS.id]);
  });

  it("rejects an unknown edition instead of falling back to the current one", async () => {
    // Silently serving 2026/1 numbers under a "2025/2" label is worse than an error: the user has
    // no way to tell the difference.
    const kpss = makeKpssFake();
    const service = new KpssService({} as never, kpss as never, makeDatasetsFake() as never);

    await expect(
      service.getCityCounts(undefined, undefined, null, "99999999-9999-4999-8999-999999999999"),
    ).rejects.toMatchObject({ details: { resource: "dataset" } });
    expect(kpss.scopes).toEqual([]);
  });
});
