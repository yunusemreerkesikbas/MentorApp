import { describe, expect, it, vi } from "vitest";
import { CohortEvidenceRepository } from "./cohort-evidence.repository";

describe("CohortEvidenceRepository", () => {
  it("normalizes raw PostgreSQL mock timestamps to Date values", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            user_id: "student-1",
            total_net: "72.50",
            taken_at: "2026-09-13T11:00:00.000Z",
            previous_net_avg: "68.25",
          },
        ],
      });
    const db = {
      transaction: async (fn: (tx: { execute: typeof execute }) => unknown) =>
        fn({ execute }),
    };
    const repository = new CohortEvidenceRepository(db as never);

    const rows = await repository.latestMocks(["student-1"]);

    expect(rows[0]?.takenAt).toBeInstanceOf(Date);
    expect(rows[0]?.takenAt.toISOString()).toBe("2026-09-13T11:00:00.000Z");
  });
});
