import { describe, expect, it, vi } from "vitest";
import { ForumHubPageService } from "./forum-hub-page.service";

const actor = { id: "reader", roles: ["STUDENT"] };
function setup() {
  const room = { id: "z", title: "QA", slug: "qa", visibility: "PUBLIC", isArchived: false, examType: null };
  const featured = { id: "q", zone: { id: "z" }, author: { displayName: "Public author" }, title: "Question", body: "Published body", coachBridge: null, commentCount: 1 };
  const hub = { featured, continueDiscussions: [], recommendedZones: [room], supporters: [], trendingTags: [] };
  const flags: Record<string, boolean> = { "ads.placement.community_overview.enabled": true, "ads.placement.community_overview.review_approved": true };
  const discovery = { getHub: vi.fn(async () => hub), getFeed: vi.fn(async () => ({ items: [] })) };
  const forum = { listZones: vi.fn(async () => ({ items: [room], total: 1 })) };
  const zones = { listPublicReviewZones: vi.fn(async () => [{ ...room, updatedAt: new Date("2026-01-01") }]) };
  const buddy = { getActivePair: vi.fn(async (): Promise<unknown> => undefined), getOutgoingPending: vi.fn(async (): Promise<unknown> => undefined), listIncomingPending: vi.fn(async (): Promise<unknown[]> => []) };
  const service = new ForumHubPageService(discovery as never, forum as never, zones as never, buddy as never, { get: async (key: string) => flags[key] } as never);
  return { service, flags, discovery, forum, zones, buddy, hub, featured };
}

describe("discovery home ad preparation", () => {
  it.each(["enabled", "review_approved"])("makes no extra reads with %s off", async (key) => {
    const s = setup(); s.flags[`ads.placement.community_overview.${key}`] = false;
    expect(await s.service.getHub(actor)).toBe(s.hub);
    expect(s.discovery.getFeed).not.toHaveBeenCalled(); expect(s.buddy.getActivePair).not.toHaveBeenCalled();
    expect(await s.service.resolve(actor, "a".repeat(64))).toEqual({ verified: false, examType: null });
  });
  it("returns the exact waiting rail with a revision and matches it on eligibility", async () => {
    const s = setup(); const page = await s.service.getHub(actor);
    expect(page.adContext?.contentRevision).toMatch(/^[a-f0-9]{64}$/);
    expect(page.adContext?.waitingQuestions).toEqual([]);
    expect(await s.service.resolve(actor, page.adContext!.contentRevision)).toEqual({ verified: true, examType: null });
    s.featured.title = "Changed";
    expect(await s.service.resolve(actor, page.adContext!.contentRevision)).toEqual({ verified: false, examType: null });
  });
  it.each(["history", "active", "outgoing", "incoming", "private", "archived", "partial-sidebar", "missing-zone", "missing-featured"])("excludes %s without changing cards", async (reason) => {
    const s = setup();
    if (reason === "history") Object.assign(s.hub, { continueDiscussions: [s.featured] });
    if (reason === "active") s.buddy.getActivePair.mockResolvedValue({ id: "pair" });
    if (reason === "outgoing") s.buddy.getOutgoingPending.mockResolvedValue({ id: "request" });
    if (reason === "incoming") s.buddy.listIncomingPending.mockResolvedValue([{}]);
    if (reason === "private") Object.assign(s.hub.recommendedZones[0]!, { visibility: "PRIVATE" });
    if (reason === "archived") s.hub.recommendedZones[0]!.isArchived = true;
    if (reason === "partial-sidebar") s.forum.listZones.mockResolvedValue({ items: [], total: 101 });
    if (reason === "missing-zone") s.zones.listPublicReviewZones.mockResolvedValue([]);
    if (reason === "missing-featured") Object.assign(s.hub, { featured: null });
    const result = await s.service.getHub(actor);
    expect(result.adContext?.contentRevision).toBeUndefined();
    expect(result.featured).toBe(s.hub.featured);
  });
  it.each(["rail", "buddy", "zones"])("preserves discovery reading after %s failure", async (failure) => {
    const s = setup();
    if (failure === "rail") s.discovery.getFeed.mockRejectedValue(new Error("unavailable"));
    if (failure === "buddy") s.buddy.getActivePair.mockRejectedValue(new Error("unavailable"));
    if (failure === "zones") s.zones.listPublicReviewZones.mockRejectedValue(new Error("unavailable"));
    expect((await s.service.getHub(actor)).featured).toBe(s.featured);
    expect(await s.service.resolve(actor, "a".repeat(64))).toEqual({ verified: false, examType: null });
  });
  it("rejects missing proofs without reading personalized data", async () => {
    const s = setup(); expect((await s.service.resolve(actor)).verified).toBe(false);
    expect(s.discovery.getHub).not.toHaveBeenCalled();
  });
  it("derives the strictest content audience and fails closed on unknown room exams", async () => {
    const s = setup();
    s.zones.listPublicReviewZones.mockResolvedValue([{ id: "z", title: "QA", slug: "qa", visibility: "PUBLIC", isArchived: false, examType: "LGS" as never, updatedAt: new Date("2026-01-01") }]);
    const page = await s.service.getHub(actor);
    expect(page.adContext?.examType).toBe("LGS");
    expect(await s.service.resolve(actor, page.adContext!.contentRevision)).toEqual({ verified: true, examType: "LGS" });
    s.zones.listPublicReviewZones.mockResolvedValue([{ id: "z", title: "QA", slug: "qa", visibility: "PUBLIC", isArchived: false, examType: "UNKNOWN" as never, updatedAt: new Date("2026-01-01") }]);
    expect((await s.service.getHub(actor)).adContext).toBeUndefined();
  });
});
