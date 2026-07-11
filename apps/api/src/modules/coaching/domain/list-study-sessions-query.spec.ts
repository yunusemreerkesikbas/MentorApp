import { describe, expect, it } from "vitest";
import { listStudySessionsQuerySchema } from "@mentor/validation";

describe("listStudySessionsQuerySchema date range", () => {
  it("accepts from/to when from <= to", () => {
    const parsed = listStudySessionsQuerySchema.parse({
      page: 1,
      pageSize: 15,
      from: "2026-07-01",
      to: "2026-07-12",
    });
    expect(parsed.from).toBe("2026-07-01");
    expect(parsed.to).toBe("2026-07-12");
  });

  it("rejects when from > to", () => {
    const result = listStudySessionsQuerySchema.safeParse({
      page: 1,
      pageSize: 15,
      from: "2026-07-20",
      to: "2026-07-10",
    });
    expect(result.success).toBe(false);
  });

  it("rejects malformed dates", () => {
    expect(
      listStudySessionsQuerySchema.safeParse({
        page: 1,
        pageSize: 15,
        from: "07-01-2026",
      }).success,
    ).toBe(false);
  });
});
