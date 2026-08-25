import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ContentService } from "../application/content.service";

interface SeedExamEvent {
  type: string;
  eventAt: string;
  source: string;
  sourceUrl: string;
  verifiedAt: string;
  verifiedBy: string;
}

interface SeedExam {
  slug: string;
  name: string;
  family: string;
  variant: string | null;
  isCurrent: boolean;
  netRule: { kind: string; divisor: number };
  events: SeedExamEvent[];
}

interface SeedFile {
  exams: SeedExam[];
}

/**
 * Loads editorial exam calendar seed on startup.
 * Fill-gaps only: never overwrite an exam or event that already exists (same contract as
 * article seed). After the first insert, W6 admin is the source of truth — otherwise every
 * API boot would reset calendar dates back to `exams.seed.json`.
 */
@Injectable()
export class ContentSeedService implements OnModuleInit {
  private readonly logger = new Logger(ContentSeedService.name);

  constructor(private readonly content: ContentService) {}

  async onModuleInit(): Promise<void> {
    try {
      const path = resolve(__dirname, "../seed/exams.seed.json");
      const raw = readFileSync(path, "utf8");
      const data = JSON.parse(raw) as SeedFile;

      for (const exam of data.exams) {
        if (!(await this.content.hasExam(exam.slug))) {
          await this.content.upsertExam({
            slug: exam.slug,
            name: exam.name,
            family: exam.family,
            variant: exam.variant,
            netRule: exam.netRule,
            isCurrent: exam.isCurrent,
          });
        }
        for (const event of exam.events) {
          if (await this.content.hasExamEvent(exam.slug, event.type)) continue;
          await this.content.upsertEvent(exam.slug, event);
        }
      }

      this.logger.log(`Exam calendar seed applied (${data.exams.length} exams).`);
    } catch (err) {
      this.logger.error("Exam calendar seed failed — countdown will be empty until fixed.", err);
    }
  }
}
