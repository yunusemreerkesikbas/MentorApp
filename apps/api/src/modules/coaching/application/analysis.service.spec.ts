import { AnalysisService } from "./analysis.service";

const topic = (subjectName: string, topicName: string, count: number) => ({
  subjectRef: subjectName.toLocaleLowerCase("tr-TR"),
  subjectName,
  topicRef: topicName.toLocaleLowerCase("tr-TR"),
  topicName,
  count,
  sharePercent: 10,
});

const analysis = {
  nextFocus: {
    subjectRef: "matematik",
    subjectName: "Matematik",
    topicName: "Problemler",
    source: "PHOTO_SIGNAL",
    evidenceCount: 5,
    recentDelta: "-2.50",
    trendDirection: "DOWN",
    message: "Ham odak mesajı",
  },
  notebookErrorSignals: [
    { errorType: "PROCESS_ERROR", count: 4, sharePercent: 40 },
  ],
  notebookStats: {
    windowDays: 60,
    savedCount: 9,
    reviewedCount: 4,
    dueCount: 3,
    healedCount: 1,
  },
  photoTopicSignals: [
    topic("Türkçe", "Paragraf", 3),
    topic("Matematik", "Problemler", 5),
    topic("Fen Bilimleri", "Kuvvet", 1),
    topic("Tarih", "İnkılaplar", 2),
    topic("Coğrafya", "İklim", 2),
  ],
  improvementCycle: {
    task: { id: "task-1", title: "Ham analiz görevi", status: "DONE" },
    steps: { planned: true, practiced: true, measured: false, closed: false },
  },
};

function makeService() {
  const service = new AnalysisService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  vi.spyOn(service, "getAnalysis").mockResolvedValue(analysis as never);
  return service;
}

describe("AnalysisService.getCoachContext", () => {
  it("adds the focus trend, the most repeated topics and where the loop stands", async () => {
    const context = await makeService().getCoachContext("user-1", "exam-1");

    expect(context.focusTrend).toEqual({ direction: "DOWN", recentDelta: "-2.50" });
    expect(context.topics).toEqual([
      { subjectName: "Matematik", topicName: "Problemler", count: 5 },
      { subjectName: "Türkçe", topicName: "Paragraf", count: 3 },
      { subjectName: "Coğrafya", topicName: "İklim", count: 2 },
    ]);
    expect(context.cycle).toEqual({ practiced: true, measured: false, closed: false });
  });

  it("never lets a task title or backend message cross into the coach context", async () => {
    const context = await makeService().getCoachContext("user-1", "exam-1");

    const serialized = JSON.stringify(context);
    expect(serialized).not.toContain("Ham analiz görevi");
    expect(serialized).not.toContain("Ham odak mesajı");
  });
});
