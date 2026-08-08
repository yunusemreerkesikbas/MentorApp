import { describe, expect, it } from "vitest";
import { buildStudySessionHrefFromPlanTask } from "./plan-study-session-link";

const task = {
  id: "33333333-3333-4333-8333-333333333333",
  title: "Türkçe: 20 soru",
  subject: "Türkçe",
};

describe("buildStudySessionHrefFromPlanTask", () => {
  it.each(["dashboard", "coach"] as const)(
    "keeps the %s source in the deep-link",
    (source: "dashboard" | "coach") => {
      expect(buildStudySessionHrefFromPlanTask(task, source)).toMatchObject({
        query: { source },
      });
    },
  );
});
