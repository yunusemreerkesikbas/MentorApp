import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "../src/database/schema-all";
import type {
  MentorshipWeeklyBriefDto,
  MentorshipWeeklySnapshotDto,
} from "@mentor/types";
import { withServiceContext } from "../src/database/rls";
import {
  MentorshipWeeklyBriefRepository,
  type WeeklyBriefGeneration,
} from "../src/modules/mentorship/infrastructure/mentorship-weekly-brief.repository";
import { MentorshipWeeklyReportRepository } from "../src/modules/mentorship/infrastructure/mentorship-weekly-report.repository";

const pool = new Pool({
  connectionString:
    process.env.TEST_DATABASE_URL ??
    "postgres://mentor:mentor@localhost:5433/mentor_test",
});
const db = drizzle(pool, { schema });
const repo = new MentorshipWeeklyBriefRepository(db);
const reports = new MentorshipWeeklyReportRepository(db);
const ids = [randomUUID(), randomUUID()];
const linkId = randomUUID();
const periodId = randomUUID();
const snapshot = {
  period: { startDate: "2026-08-31", endDate: "2026-09-06" },
} as MentorshipWeeklySnapshotDto;
let generation: WeeklyBriefGeneration;
const brief: MentorshipWeeklyBriefDto = {
  findings: [],
  coachContext: "private direction",
  model: "test",
  generatedAt: "2026-09-07T10:00:00.000Z",
  locale: "tr",
  promptVersion: "v2",
};

describe("weekly preparation database concurrency", () => {
  beforeAll(async () => {
    await withServiceContext(db, async (tx) => {
      await tx
        .insert(schema.users)
        .values(
          ids.map((id) => ({
            id,
            email: `${id}@test.local`,
            passwordHash: "unused",
            displayName: "Test",
            kvkkAcceptedAt: new Date(),
          })),
        );
      await tx
        .insert(schema.coachStudents)
        .values({
          id: linkId,
          coachId: ids[0]!,
          studentId: ids[1]!,
          status: "ACTIVE",
          source: "INVITE",
          periodId,
          acceptedAt: new Date(),
        });
    });
    const draft = await reports.upsertDraft({
      linkId,
      periodId,
      weekStart: "2026-08-31",
      weekEnd: "2026-09-06",
      locale: "tr",
      sourceFingerprint: "a".repeat(64),
      snapshot,
    });
    generation = {
      draftId: draft.id,
      sourceFingerprint: "a".repeat(64),
      locale: "tr",
      promptVersion: "v2",
      briefFingerprint: "b".repeat(64),
      generationId: randomUUID(),
    };
  });
  afterAll(async () => {
    const { inArray, eq } = await import("drizzle-orm");
    await withServiceContext(db, async (tx) => {
      await tx
        .delete(schema.coachStudents)
        .where(eq(schema.coachStudents.id, linkId));
      await tx.delete(schema.users).where(inArray(schema.users.id, ids));
    });
    await pool.end();
  });
  it("admits only one concurrent claim, refuses different pending input and dispatches once", async () => {
    const claims = await Promise.all([
      repo.markBriefPending(generation, "private direction"),
      repo.markBriefPending(
        { ...generation, generationId: randomUUID() },
        "private direction",
      ),
    ]);
    expect(claims.filter(Boolean)).toHaveLength(1);
    const draft = await reports.findDraft(linkId, periodId, "2026-08-31");
    generation.generationId = draft!.briefGenerationId!;
    expect(
      await repo.markBriefPending(
        {
          ...generation,
          briefFingerprint: "c".repeat(64),
          generationId: randomUUID(),
        },
        "other",
      ),
    ).toBe(false);
    const dispatch = await Promise.all([
      repo.markBriefStarted(generation),
      repo.markBriefStarted(generation),
    ]);
    expect(dispatch.filter(Boolean)).toHaveLength(1);
    expect(await repo.setBriefResult(generation, brief)).toBe(true);
    expect(await repo.setBriefResult(generation, null)).toBe(false);
  });
  it("reuses ready input and rejects stale generation writes after regeneration", async () => {
    expect(
      await repo.markBriefPending(
        { ...generation, generationId: randomUUID() },
        "private direction",
      ),
    ).toBe(false);
    const next = {
      ...generation,
      generationId: randomUUID(),
      briefFingerprint: "c".repeat(64),
    };
    expect(await repo.markBriefPending(next, "new direction")).toBe(true);
    expect(await repo.setBriefResult(generation, brief)).toBe(false);
    expect(await repo.setBriefResult(generation, null)).toBe(false);
    expect(
      await repo.setBriefResult(next, {
        ...brief,
        coachContext: "new direction",
      }),
    ).toBe(true);
    generation = next;
  });
  it("freezes context in a finalized coach archive and clears it on a changed snapshot", async () => {
    const row = await reports.finalize({
      linkId,
      periodId,
      weekStart: "2026-08-31",
      weekEnd: "2026-09-06",
      locale: "tr",
      sourceFingerprint: generation.sourceFingerprint,
      snapshot,
      operationId: randomUUID(),
      replacesId: null,
      coachEvaluation: null,
      brief,
    });
    expect(row.briefCoachContext).toBe("private direction");
    expect(row.brief?.coachContext).toBe("private direction");
    const draft = await reports.upsertDraft({
      linkId,
      periodId,
      weekStart: "2026-08-31",
      weekEnd: "2026-09-06",
      locale: "tr",
      sourceFingerprint: "d".repeat(64),
      snapshot,
    });
    expect(draft.briefCoachContext).toBeNull();
    expect(draft.briefGenerationId).toBeNull();
    expect(await repo.setBriefResult(generation, brief)).toBe(false);
    expect(
      (await reports.findFinalized(row.id, linkId, periodId))?.brief
        ?.coachContext,
    ).toBe("private direction");
  });
});
