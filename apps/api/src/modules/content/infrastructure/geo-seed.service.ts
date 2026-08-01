import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { GEO_REGIONS, UNIVERSITY_KINDS } from "@mentor/types";
import { GeoService } from "../application/geo.service";
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

  constructor(private readonly geo: GeoService) {}

  async onModuleInit(): Promise<void> {
    try {
      const cities = this.readCities();
      const { universities, source } = this.readUniversities(
        new Set(cities.map((c) => c.code)),
      );

      await this.geo.seedGeo({ cities, universities });

      this.logger.log(
        universities.length > 0
          ? `Geo seed applied (${cities.length} cities, ${universities.length} universities, source ${source}).`
          : `Geo seed applied (${cities.length} cities, no university dataset yet).`,
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
}
