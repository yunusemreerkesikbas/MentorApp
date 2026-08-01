import { HttpStatus } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorCode } from "../../../common/errors/error-code";
import { ForumCoachBridgeService } from "./forum-coach-bridge.service";

const THREAD_ID = "11111111-1111-4111-8111-111111111111";
const threads = { findById: vi.fn() };
const zones = { findById: vi.fn() };
const discovery = { tagsByThread: vi.fn() };
const config = { get: vi.fn() };

function service() {
  return new ForumCoachBridgeService(
    threads as never,
    zones as never,
    discovery as never,
    config as never,
  );
}

describe("ForumCoachBridgeService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    config.get.mockResolvedValue(true);
    threads.findById.mockResolvedValue({
      id: THREAD_ID,
      zoneId: "zone-1",
      title: "Bu başlık yalnız UI kartında kalır",
    });
    zones.findById.mockResolvedValue({
      id: "zone-1",
      slug: "calisma-odasi",
      title: "Çalışma Odası",
      type: "CHAT",
    });
    discovery.tagsByThread.mockResolvedValue(
      new Map([
        [
          THREAD_ID,
          [
            {
              slug: "motivasyon",
              nameTr: "Motivasyon",
              nameEn: "Motivation",
              coachIntent: "NEXT_STEP",
              isActive: true,
            },
            {
              slug: "planlama",
              nameTr: "Planlama",
              nameEn: "Planning",
              coachIntent: "PLAN",
              isActive: true,
            },
          ],
        ],
      ]),
    );
  });

  it("returns a public-safe view and a stricter LLM context", async () => {
    await expect(service().getBridge("viewer", THREAD_ID, "tr")).resolves.toEqual({
      threadId: THREAD_ID,
      intent: "PLAN",
      tag: { slug: "planlama", name: "Planlama" },
      zone: { slug: "calisma-odasi", title: "Çalışma Odası", type: "CHAT" },
      threadTitle: "Bu başlık yalnız UI kartında kalır",
    });

    const context = await service().resolveForCoach("viewer", THREAD_ID, "tr");
    expect(context).toEqual({
      threadId: THREAD_ID,
      intent: "PLAN",
      tagSlug: "planlama",
      tagName: "Planlama",
      zoneType: "CHAT",
    });
    expect(JSON.stringify(context)).not.toContain("Bu başlık");
    expect(JSON.stringify(context)).not.toContain("Çalışma Odası");
  });

  it.each(["ANNOUNCEMENT", "PRIVATE"])("rejects an ineligible %s zone", async (type) => {
    zones.findById.mockResolvedValue({
      id: "zone-1",
      slug: "duyuru",
      title: "Duyuru",
      type,
    });
    await expect(service().getBridge("viewer", THREAD_ID, "tr")).rejects.toMatchObject({
      code: ErrorCode.FORUM_THREAD_NOT_FOUND,
      httpStatus: HttpStatus.NOT_FOUND,
    });
  });

  it("returns 404 when the pilot is disabled or the source is inaccessible", async () => {
    config.get.mockImplementation((key: string) =>
      Promise.resolve(key === "forum.enabled"),
    );
    await expect(service().getBridge("viewer", THREAD_ID, "tr")).rejects.toMatchObject({
      httpStatus: HttpStatus.NOT_FOUND,
    });

    config.get.mockResolvedValue(true);
    threads.findById.mockResolvedValue(null);
    await expect(service().getBridge("viewer", THREAD_ID, "tr")).rejects.toMatchObject({
      code: ErrorCode.FORUM_THREAD_NOT_FOUND,
    });
  });

  it("rejects soft-deleted threads and archived zones even when the DB role bypasses RLS", async () => {
    threads.findById.mockResolvedValue({
      id: THREAD_ID,
      zoneId: "zone-1",
      title: null,
      deletedAt: new Date(),
    });
    await expect(service().getBridge("viewer", THREAD_ID, "tr")).rejects.toMatchObject({
      code: ErrorCode.FORUM_THREAD_NOT_FOUND,
    });

    threads.findById.mockResolvedValue({
      id: THREAD_ID,
      zoneId: "zone-1",
      title: null,
      deletedAt: null,
    });
    zones.findById.mockResolvedValue({
      id: "zone-1",
      slug: "calisma-odasi",
      title: "Çalışma Odası",
      type: "CHAT",
      isArchived: true,
    });
    await expect(service().getBridge("viewer", THREAD_ID, "tr")).rejects.toMatchObject({
      code: ErrorCode.FORUM_THREAD_NOT_FOUND,
    });
  });

  it("rejects inactive or null-intent tags", async () => {
    discovery.tagsByThread.mockResolvedValue(
      new Map([
        [
          THREAD_ID,
          [
            { slug: "planlama", coachIntent: "PLAN", isActive: false },
            { slug: "kaynak-onerisi", coachIntent: null, isActive: true },
          ],
        ],
      ]),
    );
    await expect(service().getBridge("viewer", THREAD_ID, "tr")).rejects.toMatchObject({
      code: ErrorCode.FORUM_THREAD_NOT_FOUND,
    });
  });
});
