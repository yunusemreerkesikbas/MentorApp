import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { GEO_REGIONS, UNIVERSITY_KINDS } from "@mentor/types";
import { GeoService } from "../application/geo.service";
import { DatasetService } from "../application/dataset.service";
import type { NewReferenceDataset } from "./dataset.repository";
import { KpssService } from "../application/kpss.service";
import type { NewCity, NewUniversity } from "./geo.repository";

interface SeedCity {
  code: string;
  name: string;
  slug: string;
  region: string;
}

interface CitySeedFile {
  cities: SeedCity[];
}

interface SeedUniversity {
  cityCode: string;
  name: string;
  slug: string;
  kind: string;
  foundedYear?: number | null;
  websiteUrl?: string | null;
  /** Strings, not numbers — they map straight onto a Postgres `numeric` column. */
  latitude?: string | null;
  longitude?: string | null;
}

interface UniversitySeedFile {
  source: string;
  sourceUrl: string;
  verifiedAt: string | null;
  universities: SeedUniversity[];
}

interface SeedNamed {
  name: string;
  slug: string;
}

interface SeedPosting {
  osymCode: string;
  educationLevel: string;
  titleName: string;
  institutionName: string;
  cityCode: string;
  district?: string | null;
  employmentType: string;
  serviceClass?: string | null;
  grade?: number | null;
  quota: number;
}

interface DatasetSeedEntry {
  examFamily: string;
  kind: string;
  period: string;
  sortKey: number;
  isCurrent?: boolean;
  descriptionTr?: string | null;
  descriptionEn?: string | null;
  source: string;
  sourceUrl: string;
  verifiedAt: string;
}

interface KpssSeedFile {
  /** Placement round, e.g. "2026-1". Doubles as the dataset edition's period. */
  round: string | null;
  /** Marks this file as the edition served when no period is requested. */
  isCurrent?: boolean;
  /** Editorial note shown beside the data; managed per edition, not in code. */
  descriptionTr?: string | null;
  descriptionEn?: string | null;
  source: string;
  sourceUrl: string;
  verifiedAt: string | null;
  titles: SeedNamed[];
  institutions: SeedNamed[];
  postings: SeedPosting[];
}

/** Shape `KpssService.seedKpss` expects: reference rows plus postings still keyed by slug. */
type KpssSeed = Parameters<KpssService["seedKpss"]>[0];

/**
 * "2026-1" -> 20261, so editions sort numerically. Text ordering puts "2026-10" before "2026-2",
 * which is how the previous `ORDER BY round DESC` would eventually have picked the wrong default.
 */
function periodSortKey(period: string): number {
  const [year, index] = period.split("-");
  const y = Number(year);
  if (!Number.isInteger(y)) {
    throw new Error(`kpss seed: round "${period}" must start with a year`);
  }
  return y * 10 + (index ? Number(index) : 0);
}

/**
 * Loads the geo reference seed on startup (idempotent batch upserts).
 *
 * The university file may legitimately be empty: cities alone make the map usable, so a missing
 * editorial import degrades to "every province reports zero universities" rather than blocking boot.
 * What is NOT tolerated is malformed data — a bad region or kind would render wrong in the UI
 * without any error, so it fails loudly here instead.
 */
@Injectable()
export class GeoSeedService implements OnModuleInit {
  private readonly logger = new Logger(GeoSeedService.name);

  constructor(
    private readonly geo: GeoService,
    private readonly kpss: KpssService,
    private readonly datasets: DatasetService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      const cities = this.readCities();
      const { universities, source } = this.readUniversities(
        new Set(cities.map((c) => c.code)),
      );

      const rounds = this.readKpssRounds(new Set(cities.map((c) => c.code)));
      const editions = this.readDatasets();

      await this.geo.seedGeo({ cities, universities });
      await this.datasets.seedDatasets(editions);
      // Oldest first, so the newest round is written last and holds `isCurrent` — the promotion
      // inside `seedKpss` demotes whichever edition held it before.
      for (const round of rounds) {
        await this.kpss.seedKpss(round);
      }

      this.logger.log(
        universities.length > 0
          ? `Geo seed applied (${cities.length} cities, ${universities.length} universities, source ${source}).`
          : `Geo seed applied (${cities.length} cities, no university dataset yet).`,
      );
      this.logger.log(
        rounds.length > 0
          ? `KPSS seed applied (${rounds.length} round(s): ${rounds
              .map(
                (r) =>
                  `${r.dataset.period}${r.dataset.isCurrent ? "*" : ""} ${r.postings.length} postings`,
              )
              .join(", ")}).`
          : "KPSS seed skipped (no placement round imported yet).",
      );
      if (editions.length > 0) {
        this.logger.log(
          `Dataset editions applied (${editions.map((d) => `${d.kind} ${d.period}`).join(", ")}).`,
        );
      }
    } catch (err) {
      this.logger.error("Geo seed failed.", err);
      throw err;
    }
  }

  private readCities(): NewCity[] {
    const path = resolve(__dirname, "../seed/cities.seed.json");
    const data = JSON.parse(readFileSync(path, "utf8")) as CitySeedFile;

    return data.cities.map((city) => {
      if (!(GEO_REGIONS as readonly string[]).includes(city.region)) {
        throw new Error(
          `cities.seed.json: unknown region "${city.region}" on ${city.code} ${city.name}`,
        );
      }
      return {
        code: city.code,
        name: city.name,
        slug: city.slug,
        region: city.region,
      };
    });
  }

  private readUniversities(cityCodes: Set<string>): {
    universities: NewUniversity[];
    source: string;
  } {
    const path = resolve(__dirname, "../seed/universities.seed.json");
    const data = JSON.parse(readFileSync(path, "utf8")) as UniversitySeedFile;

    if (data.universities.length === 0) return { universities: [], source: "" };

    if (!data.source || !data.sourceUrl || !data.verifiedAt) {
      throw new Error(
        "universities.seed.json: source, sourceUrl and verifiedAt are mandatory once rows exist (guardrail §4 #1 — the UI renders them as a trust badge).",
      );
    }
    const verifiedAt = new Date(data.verifiedAt);
    if (Number.isNaN(verifiedAt.getTime())) {
      throw new Error(
        `universities.seed.json: invalid verifiedAt "${data.verifiedAt}"`,
      );
    }

    const universities = data.universities.map((uni) => {
      if (!cityCodes.has(uni.cityCode)) {
        throw new Error(
          `universities.seed.json: unknown cityCode "${uni.cityCode}" on ${uni.name}`,
        );
      }
      if (!(UNIVERSITY_KINDS as readonly string[]).includes(uni.kind)) {
        throw new Error(
          `universities.seed.json: unknown kind "${uni.kind}" on ${uni.name}`,
        );
      }
      return {
        cityCode: uni.cityCode,
        name: uni.name,
        slug: uni.slug,
        kind: uni.kind,
        foundedYear: uni.foundedYear ?? null,
        websiteUrl: uni.websiteUrl ?? null,
        latitude: uni.latitude ?? null,
        longitude: uni.longitude ?? null,
        source: data.source,
        sourceUrl: data.sourceUrl,
        verifiedAt,
      };
    });

    return { universities, source: data.source };
  }

  /**
   * Editions whose rows are not seeded from a period file — today just the YKS guide year.
   *
   * A dataset row with no rows of its own still earns its place: it carries the source note the UI
   * renders, which is the whole point of managing that copy from the backend instead of hardcoding
   * a sentence and a URL in the map component.
   */
  private readDatasets(): NewReferenceDataset[] {
    const path = resolve(__dirname, "../seed/datasets.seed.json");
    let data: { datasets: DatasetSeedEntry[] };
    try {
      data = JSON.parse(readFileSync(path, "utf8")) as { datasets: DatasetSeedEntry[] };
    } catch {
      return [];
    }
    return (data.datasets ?? []).map((d) => {
      const verifiedAt = new Date(d.verifiedAt);
      if (Number.isNaN(verifiedAt.getTime())) {
        throw new Error(`datasets.seed.json: invalid verifiedAt on ${d.kind} ${d.period}`);
      }
      return {
        examFamily: d.examFamily,
        kind: d.kind,
        period: d.period,
        sortKey: d.sortKey,
        isCurrent: d.isCurrent ?? false,
        descriptionTr: d.descriptionTr ?? null,
        descriptionEn: d.descriptionEn ?? null,
        source: d.source,
        sourceUrl: d.sourceUrl,
        verifiedAt,
      };
    });
  }

  /**
   * Every imported placement round, oldest first.
   *
   * Adding a round is dropping a `kpss.<period>.seed.json` next to the existing one — nothing is
   * deleted and no code changes, which is what makes the period picker have a history to show.
   */
  private readKpssRounds(cityCodes: Set<string>): KpssSeed[] {
    const dir = resolve(__dirname, "../seed");
    let files: string[];
    try {
      files = readdirSync(dir).filter((f) => /^kpss.*\.seed\.json$/.test(f));
    } catch {
      return [];
    }

    const rounds = files
      .map((f) => this.readKpss(cityCodes, f))
      .filter((r): r is KpssSeed => r !== null)
      .sort((a, b) => a.dataset.sortKey - b.dataset.sortKey);

    const periods = new Set(rounds.map((r) => r.dataset.period));
    if (periods.size !== rounds.length) {
      throw new Error(
        "kpss seed: two files declare the same round; one would overwrite the other's postings.",
      );
    }
    // Exactly one current edition, decided here rather than trusting every file to agree.
    const newest = rounds.at(-1);
    for (const round of rounds) {
      round.dataset.isCurrent = round === newest;
    }
    return rounds;
  }

  /**
   * One KPSS placement round. Absent or empty is a supported state — the goal screen still works
   * from the title list alone, and a KPSS user without an imported round sees no vacancy counts.
   * Malformed data is not tolerated, for the same reason as above: it would render wrong silently.
   */
  private readKpss(cityCodes: Set<string>, fileName: string): KpssSeed | null {
    const path = resolve(__dirname, "../seed", fileName);
    let data: KpssSeedFile;
    try {
      data = JSON.parse(readFileSync(path, "utf8")) as KpssSeedFile;
    } catch {
      return null;
    }

    if (data.postings.length === 0) return null;
    if (!data.source || !data.sourceUrl || !data.verifiedAt || !data.round) {
      throw new Error(
        `${fileName}: round, source, sourceUrl and verifiedAt are mandatory once rows exist (guardrail §4 #1 — the UI renders the round as a trust badge).`,
      );
    }
    const verifiedAt = new Date(data.verifiedAt);
    if (Number.isNaN(verifiedAt.getTime())) {
      throw new Error(`${fileName}: invalid verifiedAt "${data.verifiedAt}"`);
    }

    const trust = { source: data.source, sourceUrl: data.sourceUrl, verifiedAt };
    // Slugs come from the file's own reference lists rather than being recomputed here: the
    // importer already applied `scripts/lib/turkish.mjs`, and a second implementation in the
    // service is exactly how the two would drift apart.
    const titleSlugByName = new Map(data.titles.map((t) => [t.name, t.slug]));
    const institutionSlugByName = new Map(
      data.institutions.map((i) => [i.name, i.slug]),
    );

    const postings = data.postings.map((p) => {
      if (!cityCodes.has(p.cityCode)) {
        throw new Error(
          `${fileName}: unknown cityCode "${p.cityCode}" on posting ${p.osymCode}`,
        );
      }
      const titleSlug = titleSlugByName.get(p.titleName);
      const institutionSlug = institutionSlugByName.get(p.institutionName);
      if (!titleSlug || !institutionSlug) {
        throw new Error(
          `${fileName}: posting ${p.osymCode} names a title/institution missing from the reference lists`,
        );
      }
      return {
        osymCode: p.osymCode,
        educationLevel: p.educationLevel,
        cityCode: p.cityCode,
        district: p.district ?? null,
        employmentType: p.employmentType,
        serviceClass: p.serviceClass ?? null,
        grade: p.grade ?? null,
        quota: p.quota,
        titleSlug,
        institutionSlug,
        ...trust,
      };
    });

    return {
      dataset: {
        period: data.round,
        sortKey: periodSortKey(data.round),
        // A file with no explicit flag still becomes current when it is the only one loaded;
        // `seedGeo` promotes the highest sortKey below.
        isCurrent: data.isCurrent ?? false,
        descriptionTr: data.descriptionTr ?? null,
        descriptionEn: data.descriptionEn ?? null,
        ...trust,
      },
      titles: data.titles.map((t) => ({ name: t.name, slug: t.slug, ...trust })),
      institutions: data.institutions.map((i) => ({
        name: i.name,
        slug: i.slug,
        ...trust,
      })),
      postings,
    };
  }
}
