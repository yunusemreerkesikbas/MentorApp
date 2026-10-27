import { describe, expect, it } from "vitest";
import { buildCommunityQuestionSnapshot } from "./community-question-snapshot";

function setup() {
  const question = { id: "q", zoneId: "z", title: "Question", body: "Body", authorName: "Asker", authorUsername: "asker", authorAvatarUrl: null,
    attachments: [], tags: [{ slug: "tag" }], createdAt: "2030-01-01", coachBridge: null, poll: null };
  const answer = { id: "a", body: "Answer", authorName: "Helper", authorUsername: "helper", authorAvatarUrl: null, attachments: [], isAccepted: false, createdAt: "2030-01-02" };
  const publicQuestion = { id: "q", title: "Question", body: "Body", contentRevision: "a".repeat(64), examType: "LGS", answers: [answer] };
  const zones = [{ id: "z", title: "QA", slug: "qa", updatedAt: new Date("2030-01-01") }];
  const waiting = [{ id: "w", title: "Waiting", body: "Other", createdAt: "2030-01-03", author: { displayName: "Other user" }, zone: { id: "z", title: "QA", slug: "qa" } }];
  const detail = { question, answers: [answer] };
  return { question, answer, publicQuestion, zones, waiting, detail,
    build: () => buildCommunityQuestionSnapshot(publicQuestion as never, detail as never, zones as never, waiting as never) };
}
describe("community question publisher snapshot", () => {
  it("hashes the reviewed publisher content and omits private action state", () => {
    const { build, detail } = setup();
    const first = build()!;
    expect(first.contentRevision).toMatch(/^[a-f0-9]{64}$/);
    Object.assign(detail.question, { myBookmarked: true, myHelpfulVote: true, helpfulVoteCount: 50 });
    expect(build()?.contentRevision).toBe(first.contentRevision);
    expect(first.question).not.toHaveProperty("myBookmarked");
  });
  it.each(["identity", "avatar", "attachments", "tags", "zone", "waiting"])("invalidates approval after %s changes", (change) => {
    const { build, question, answer, zones, waiting } = setup();
    const before = build()?.contentRevision;
    if (change === "identity") answer.authorName = "Renamed";
    if (change === "avatar") Object.assign(question, { authorAvatarUrl: "/new-avatar.webp" });
    if (change === "attachments") Object.assign(answer, { attachments: [{ id: "image", kind: "image", url: "/image.webp", fileName: null }] });
    if (change === "tags") question.tags[0]!.slug = "changed";
    if (change === "zone") zones[0]!.title = "Renamed zone";
    if (change === "waiting") waiting[0]!.title = "New recommendation";
    expect(build()?.contentRevision).not.toBe(before);
  });
  it.each(["private-zone", "stale-body", "missing-answer", "coach", "inline-image", "answer-inline-image", "poll", "non-image"])("rejects %s context", (reason) => {
    const { build, zones, question, answer, publicQuestion } = setup();
    if (reason === "private-zone") zones.length = 0;
    if (reason === "stale-body") question.body = "An unreviewed edit";
    if (reason === "missing-answer") publicQuestion.answers = [];
    if (reason === "coach") Object.assign(question, { coachBridge: { private: true } });
    if (reason === "inline-image") { question.body = "![external](https://example.test/image)"; publicQuestion.body = question.body; }
    if (reason === "answer-inline-image") answer.body = "![draft](https://example.test/image)";
    if (reason === "non-image") Object.assign(answer, { attachments: [{ kind: "file", url: "/notes.pdf" }] });
    if (reason === "poll") Object.assign(question, { poll: { options: [] } });
    expect(build()).toBeNull();
  });
});
