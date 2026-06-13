import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ContentService } from "../application/content.service";

interface SeedSubject {
  slug: string;
  name: string;
}

interface SeedExamSubject {
  examSlug: string;
  subjectSlug: string;
  questionCount: number;
  sortOrder: number;
}

interface SeedFile {
  subjects: SeedSubject[];
  examSubjects: SeedExamSubject[];
}

/**
 * Loads editorial subject taxonomy seed on startup (idempotent upserts).
 * Runs after exam calendar seed so exam rows exist for exam_subjects links.
 */
@Injectable()
export class SubjectSeedService implements OnModuleInit {
  private readonly logger = new Logger(SubjectSeedService.name);

  constructor(private readonly content: ContentService) {}

  async onModuleInit(): Promise<void> {
    try {
      const path = resolve(__dirname, "../seed/subjects.seed.json");
      const raw = readFileSync(path, "utf8");
      const data = JSON.parse(raw) as SeedFile;

      for (const subject of data.subjects) {
        await this.content.upsertSubject(subject);
      }
      for (const link of data.examSubjects) {
        await this.content.linkExamSubject(link);
      }

      this.logger.log(
        `Subject taxonomy seed applied (${data.subjects.length} subjects, ${data.examSubjects.length} exam links).`,
      );
    } catch (err) {
      this.logger.error("Subject taxonomy seed failed.", err);
      throw err;
    }
  }
}
