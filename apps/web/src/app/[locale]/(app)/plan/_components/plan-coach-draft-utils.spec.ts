// The repository reuses apps/api's Vitest runner; apps/web intentionally has no test dependency.
// @ts-expect-error -- resolved by the explicit @mentor/api Vitest command used for this spec.
import { describe, expect, it } from "vitest";
import type { CoachPlanDraftDto } from "@mentor/types";
import {
  flattenCoachPlanDraft,
  selectedDraftTasks,
} from "./plan-coach-draft-utils";

const draft: CoachPlanDraftDto = {
  model: "test",
  days: [
    {
      date: "2026-07-16",
      tasks: [
        { title: "Paragraf denemesi", subject: "Türkçe" },
        { title: "Problem çöz", subject: "Matematik" },
      ],
    },
    {
      date: "2026-07-17",
      tasks: [{ title: "Tarih tekrar", subject: null }],
    },
  ],
};

describe("coach plan draft selection", () => {
  it("flattens dated tasks into stable preview rows", () => {
    expect(flattenCoachPlanDraft(draft)).toEqual([
      {
        key: "2026-07-16:0",
        date: "2026-07-16",
        title: "Paragraf denemesi",
        subject: "Türkçe",
      },
      {
        key: "2026-07-16:1",
        date: "2026-07-16",
        title: "Problem çöz",
        subject: "Matematik",
      },
      {
        key: "2026-07-17:0",
        date: "2026-07-17",
        title: "Tarih tekrar",
        subject: null,
      },
    ]);
  });

  it("maps only selected rows to the existing bulk contract", () => {
    const rows = flattenCoachPlanDraft(draft);
    const selected = new Set(["2026-07-16:1", "2026-07-17:0"]);

    expect(selectedDraftTasks(rows, selected)).toEqual([
      {
        taskDate: "2026-07-16",
        title: "Problem çöz",
        subject: "Matematik",
      },
      {
        taskDate: "2026-07-17",
        title: "Tarih tekrar",
        subject: null,
      },
    ]);
  });
});
