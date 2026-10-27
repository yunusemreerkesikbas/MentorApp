import { describe, expect, it, vi } from "vitest";
import { DomainError } from "../../../common/errors/domain-error";
import { ForumQuestionPageService } from "./forum-question-page.service";

function setup(enabled = true) {
  const answer = { id: "a", body: "Answer", isAccepted: false, attachments: [] };
  const detail = { question: { id: "q", zoneId: "z", title: "Question", body: "Body", attachments: [] }, answers: [answer] };
  const qa = { getQuestion: vi.fn(async () => detail) };
  const published = { getQuestion: vi.fn(async () => ({ id: "q", title: "Question", body: "Body", contentRevision: "a".repeat(64), examType: "LGS", answers: [answer] })) };
  const discovery = { getFeed: vi.fn(async () => ({ items: [] })) };
  const zones = { listPublicReviewZones: vi.fn(async () => [{ id: "z", title: "QA", slug: "qa", updatedAt: new Date() }]) };
  const service = new ForumQuestionPageService(qa as never, published as never, discovery as never, zones as never, { get: async () => enabled } as never);
  return { service, qa, published, discovery, zones, detail };
}
const actor = { id: "reader", roles: ["STUDENT"] };
describe("community question page context", () => {
  it("adds no publication or recommendation reads when the placement is off", async () => {
    const { service, qa, discovery, published } = setup(false);
    expect(await service.getQuestion(actor, "q")).toBe(await qa.getQuestion());
    expect(discovery.getFeed).not.toHaveBeenCalled();
    expect(published.getQuestion).not.toHaveBeenCalled();
  });
  it("provides one server-owned rail and matching publisher revision", async () => {
    const { service } = setup();
    const detail = await service.getQuestion(actor, "q");
    expect(detail.pageContext?.waitingQuestions).toEqual([]);
    expect(detail.pageContext?.adContentRevision).toMatch(/^[a-f0-9]{64}$/);
  });
  it("preserves reading when recommendation or visibility proof fails", async () => {
    const { service, discovery, zones } = setup();
    discovery.getFeed.mockRejectedValueOnce(new Error("Feed unavailable"));
    expect((await service.getQuestion(actor, "q")).pageContext).toMatchObject({ adContentRevision: null, waitingQuestions: null });
    zones.listPublicReviewZones.mockRejectedValueOnce(new Error("Zone unavailable"));
    expect((await service.getQuestion(actor, "q")).question.body).toBe("Body");
  });
  it("lets reviewers revoke unavailable questions without exposing private content", async () => {
    const { service, qa } = setup();
    qa.getQuestion.mockRejectedValueOnce(new DomainError("NOT_FOUND", 404));
    expect(await service.getReviewSnapshot(actor, "q")).toBeNull();
    qa.getQuestion.mockRejectedValueOnce(new Error("Database unavailable"));
    await expect(service.getReviewSnapshot(actor, "q")).rejects.toThrow("Database unavailable");
  });
});
