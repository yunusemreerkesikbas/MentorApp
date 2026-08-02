import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { GEO_REGIONS, UNIVERSITY_KINDS } from "@mentor/types";
import { GeoService } from "../application/geo.service";
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
  round: string;
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

interface KpssSeedFile {
  round: string | null;
  source: string;
  sourceUrl: string;
  verifiedAt: string | null;
  titles: SeedNamed[];
  institutions: SeedNamed[];
  postings: SeedPosting[];
}

/** Shape `KpssService.seedKpss` expects: reference rows plus postings still keyed by slug. */
type KpssSeed = Parameters<KpssService["seedKpss"]>[0] & { round: string | null };

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
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      const cities = this.readCities();
      const { universities, source } = this.readUniversities(
        new Set(cities.map((c) => c.code)),
      );

      const kpss = this.readKpss(new Set(cities.map((c) => c.code)));

      await this.geo.seedGeo({ cities, universities });
      await this.kpss.seedKpss(kpss);

      this.logger.log(
        universities.length > 0
          ? `Geo seed applied (${cities.length} cities, ${universities.length} universities, source ${source}).`
          : `Geo seed applied (${cities.length} cities, no university dataset yet).`,
      );
      this.logger.log(
        kpss.postings.length > 0
          ? `KPSS seed applied (${kpss.titles.length} titles, ${kpss.institutions.length} institutions, ${kpss.postings.length} postings, round ${kpss.round}).`
          : "KPSS seed skipped (no placement round imported yet).",
      );
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
   * KPSS placement round. Absent or empty is a supported state — the goal screen still works from
   * the title list alone, and a KPSS user without an imported round simply sees no vacancy counts.
   * Malformed data is not tolerated, for the same reason as above: it would render wrong silently.
   */
  private readKpss(cityCodes: Set<string>): KpssSeed {
    const path = resolve(__dirname, "../seed/kpss.seed.json");
    let data: KpssSeedFile;
    try {
      data = JSON.parse(readFileSync(path, "utf8")) as KpssSeedFile;
    } catch {
      return { titles: [], institutions: [], postings: [], round: null };
    }

    if (data.postings.length === 0) {
      return { titles: [], institutions: [], postings: [], round: null };
    }
    if (!data.source || !data.sourceUrl || !data.verifiedAt || !data.round) {
      throw new Error(
        "kpss.seed.json: round, source, sourceUrl and verifiedAt are mandatory once rows exist (guardrail §4 #1 — the UI renders the round as a trust badge).",
      );
    }
    const verifiedAt = new Date(data.verifiedAt);
    if (Number.isNaN(verifiedAt.getTime())) {
      throw new Error(`kpss.seed.json: invalid verifiedAt "${data.verifiedAt}"`);
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
          `kpss.seed.json: unknown cityCode "${p.cityCode}" on posting ${p.osymCode}`,
        );
      }
      const titleSlug = titleSlugByName.get(p.titleName);
      const institutionSlug = institutionSlugByName.get(p.institutionName);
      if (!titleSlug || !institutionSlug) {
        throw new Error(
          `kpss.seed.json: posting ${p.osymCode} names a title/institution missing from the reference lists`,
        );
      }
      return {
        osymCode: p.osymCode,
        round: p.round,
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
      round: data.round,
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
