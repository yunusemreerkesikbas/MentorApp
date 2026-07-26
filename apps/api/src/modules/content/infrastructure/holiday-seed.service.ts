import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ContentService } from "../application/content.service";

interface SeedHoliday {
  date: string;
  name: string;
  kind: string;
  /** Per-entry override; falls back to the file-level verification stamp. */
  verifiedAt?: string;
  source?: string;
  sourceUrl?: string;
  verifiedBy?: string;
}

interface HolidaySeedFile {
  country: string;
  source: string;
  sourceUrl: string;
  verifiedBy: string;
  verifiedAt?: string;
  holidays: SeedHoliday[];
}

/**
 * Loads the official public-holiday seed on startup (idempotent upserts).
 *
 * Together with W6 admin this is the ONLY way official holiday dates enter the system — they are
 * never computed, because the religious holidays follow the Hijri calendar and are fixed by an
 * official announcement (guardrail §4 #1). A missing year simply renders no holidays.
 */
@Injectable()
export class HolidaySeedService implements OnModuleInit {
  private readonly logger = new Logger(HolidaySeedService.name);

  constructor(private readonly content: ContentService) {}

  async onModuleInit(): Promise<void> {
    try {
      const path = resolve(__dirname, "../seed/holidays.seed.json");
      const data = JSON.parse(readFileSync(path, "utf8")) as HolidaySeedFile;
      const fallbackVerifiedAt = data.verifiedAt ?? new Date(0).toISOString();

      for (const holiday of data.holidays) {
        await this.content.upsertPublicHoliday({
          country: data.country,
          date: holiday.date,
          name: holiday.name,
          kind: holiday.kind,
          source: holiday.source ?? data.source,
          sourceUrl: holiday.sourceUrl ?? data.sourceUrl,
          verifiedBy: holiday.verifiedBy ?? data.verifiedBy,
          verifiedAt: holiday.verifiedAt ?? fallbackVerifiedAt,
        });
      }

      this.logger.log(
        `Public holiday seed applied (${data.holidays.length} entries, ${data.country}).`,
      );
    } catch (err) {
      this.logger.error(
        "Public holiday seed failed — the calendar will simply show no holidays.",
        err,
      );
    }
  }
}
