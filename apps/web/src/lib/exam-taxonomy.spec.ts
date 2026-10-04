import { describe, expect, it } from "vitest";
import { groupTopicsBySubjectName } from "./exam-taxonomy";

describe("groupTopicsBySubjectName", () => {
  it("keeps taxonomy order and groups topic display names under the parent subject", () => {
    const grouped = groupTopicsBySubjectName([
      {
        subjectSlug: "matematik",
        subjectName: "Matematik",
        slug: "problemler",
        name: "Problemler",
        sortOrder: 1,
      },
      {
        subjectSlug: "turkce",
        subjectName: "Türkçe",
        slug: "paragraf",
        name: "Paragraf",
        sortOrder: 0,
      },
      {
        subjectSlug: "matematik",
        subjectName: "Matematik",
        slug: "geometri",
        name: "Geometri",
        sortOrder: 2,
      },
    ]);

    expect(grouped.subjects).toEqual(["Türkçe", "Matematik"]);
    expect(grouped.topicsBySubject.get("Matematik")).toEqual([
      "Problemler",
      "Geometri",
    ]);
  });
});
