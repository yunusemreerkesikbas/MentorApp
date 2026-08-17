import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { appendFileSync, readFileSync } from "node:fs";
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
        if (await this.content.hasExam(exam.slug)) {
          // #region agent log
          fetch("http://127.0.0.1:7497/ingest/21f8ef43-7e17-46b1-8c00-47111ca62dd3", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Debug-Session-Id": "54e609",
            },
            body: JSON.stringify({
              sessionId: "54e609",
              runId: "post-fix",
              hypothesisId: "H1",
              location: "content-seed.service.ts:onModuleInit:skipExam",
              message: "Exam calendar seed skipped existing exam",
              data: { slug: exam.slug, pid: process.pid, uptimeSec: Math.round(process.uptime()) },
              timestamp: Date.now(),
            }),
          }).catch(() => {});
          // #endregion
        } else {
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
          if (await this.content.hasExamEvent(exam.slug, event.type)) {
            // #region agent log
            fetch("http://127.0.0.1:7497/ingest/21f8ef43-7e17-46b1-8c00-47111ca62dd3", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Debug-Session-Id": "54e609",
              },
              body: JSON.stringify({
                sessionId: "54e609",
                runId: "post-fix",
                hypothesisId: "H1",
                location: "content-seed.service.ts:onModuleInit:skipEvent",
                message: "Exam calendar seed skipped existing event",
                data: {
                  slug: exam.slug,
                  type: event.type,
                  seedEventAt: event.eventAt,
                  pid: process.pid,
                },
                timestamp: Date.now(),
              }),
            }).catch(() => {});
            // #endregion
            try {
              appendFileSync(
                "c:/Users/emreerkesikbas/Documents/MentorApp/debug-54e609.log",
                `${JSON.stringify({
                  sessionId: "54e609",
                  runId: "post-fix",
                  hypothesisId: "H1",
                  location: "content-seed.service.ts:onModuleInit:skipEvent:file",
                  message: "Exam calendar seed skipped existing event (file)",
                  data: { slug: exam.slug, type: event.type, seedEventAt: event.eventAt },
                  timestamp: Date.now(),
                })}\n`,
              );
            } catch {
              /* ignore */
            }
            continue;
          }
          await this.content.upsertEvent(exam.slug, event);
          // #region agent log
          fetch("http://127.0.0.1:7497/ingest/21f8ef43-7e17-46b1-8c00-47111ca62dd3", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Debug-Session-Id": "54e609",
            },
            body: JSON.stringify({
              sessionId: "54e609",
              runId: "pre-fix",
              hypothesisId: "H1",
              location: "content-seed.service.ts:onModuleInit",
              message: "Exam calendar seed upserted event",
              data: {
                slug: exam.slug,
                type: event.type,
                eventAt: event.eventAt,
                verifiedBy: event.verifiedBy,
                pid: process.pid,
                uptimeSec: Math.round(process.uptime()),
              },
              timestamp: Date.now(),
            }),
          }).catch(() => {});
          // #endregion
        }
      }

      this.logger.log(`Exam calendar seed applied (${data.exams.length} exams).`);
    } catch (err) {
      this.logger.error("Exam calendar seed failed — countdown will be empty until fixed.", err);
    }
  }
}
