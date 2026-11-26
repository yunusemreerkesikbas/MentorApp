import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { UserNotificationDto } from "@mentor/types";
import {
  flattenNotificationGroups,
  formatNotificationTime,
  groupNotificationsByRecency,
  resolveMobileNotificationDestination,
} from "./notifications-view.ts";

function makeNotif(
  id: string,
  createdAt: string,
  readAt: string | null = null,
  linkUrl: string | null = null,
): UserNotificationDto {
  return {
    id,
    category: "PLAN",
    title: `Title ${id}`,
    body: `Body ${id}`,
    readAt,
    linkUrl,
    createdAt,
  };
}

describe("notifications-view helpers", () => {
  it("groups newest-first notifications into consecutive recency buckets", () => {
    const now = Date.parse("2026-11-20T12:00:00.000Z");
    const items = [
      makeNotif("1", "2026-11-20T11:30:00.000Z"),
      makeNotif("2", "2026-11-20T05:00:00.000Z"),
      makeNotif("3", "2026-11-18T10:00:00.000Z"),
      makeNotif("4", "2026-11-01T10:00:00.000Z"),
    ];

    const groups = groupNotificationsByRecency(items, now);
    assert.deepEqual(
      groups.map((g) => [g.key, g.items.map((i) => i.id)]),
      [
        ["today", ["1", "2"]],
        ["week", ["3"]],
        ["earlier", ["4"]],
      ],
    );

    const flat = flattenNotificationGroups(items, now);
    assert.deepEqual(
      flat.map((r) => (r.kind === "header" ? `H:${r.group}` : `I:${r.item.id}`)),
      ["H:today", "I:1", "I:2", "H:week", "I:3", "H:earlier", "I:4"],
    );
  });

  it("formats relative labels under 7 days and Istanbul calendar day for older items", () => {
    const now = Date.parse("2026-11-20T12:00:00.000Z");
    const labels = {
      timeJustNow: "Az önce",
      timeHoursAgo: (c: number) => `${c} saat önce`,
      timeYesterday: "Dün",
      timeDaysAgo: (c: number) => `${c} gün önce`,
    };

    assert.equal(formatNotificationTime("2026-11-20T11:40:00.000Z", "tr", labels, now), "Az önce");
    assert.equal(formatNotificationTime("2026-11-20T09:00:00.000Z", "tr", labels, now), "3 saat önce");
    assert.equal(formatNotificationTime("2026-11-19T08:00:00.000Z", "tr", labels, now), "Dün");
    assert.equal(formatNotificationTime("2026-11-17T08:00:00.000Z", "tr", labels, now), "3 gün önce");
    // 2026-10-31T21:00:00.000Z is 2026-11-01T00:00:00+03:00 in Europe/Istanbul
    assert.equal(formatNotificationTime("2026-10-31T21:00:00.000Z", "tr", labels, now), "1 Kasım 2026");
    assert.equal(formatNotificationTime("2026-10-31T21:00:00.000Z", "en", labels, now), "1 November 2026");
  });

  it("opens localized desk, page, review, and collage links with their context", () => {
    const open = (url: string) => resolveMobileNotificationDestination(url, false);
    assert.deepEqual(open("/tr/defterlerim"), { pathname: "/(app)/notebooks" });
    assert.deepEqual(open("/en/notebooks/book-1?page=4#photo"), {
      pathname: "/(app)/notebook", params: { notebookId: "book-1", page: "4" },
    });
    assert.deepEqual(open("/tr/yanlis-defteri?review=focus&entryId=e2&topicRef=geometri"), {
      pathname: "/(app)/notebook", params: { review: "focus", entry: "e2", topicRef: "geometri" },
    });
    assert.deepEqual(open("/en/notebook?review=focus&revisit=true&days=30"), {
      pathname: "/(app)/notebook", params: { review: "focus", revisit: "true", days: "30" },
    });
    assert.deepEqual(open("/hedef"), { pathname: "/(app)/vision-board" });
    assert.deepEqual(open("/tr/hedef/pano"), { pathname: "/(app)/vision-board/board" });
    assert.deepEqual(open("/en/vision-board/board"), { pathname: "/(app)/vision-board/board" });
    assert.equal(open("/vision-board/simulation"), null);
    assert.equal(open("//outside.example/notebooks"), null);
    assert.deepEqual(open("/community/comment/c1?highlight=r2"), {
      pathname: "/(app)/community-comment", params: { id: "c1", highlight: "r2" },
    });
    assert.deepEqual(open("/tr/topluluk/yorum/c1"), { pathname: "/(app)/community-comment", params: { id: "c1" } });
  });

  it("resolves student-core safe destinations and extracts knowledge slugs", () => {
    assert.deepEqual(resolveMobileNotificationDestination("/plan", true), {
      pathname: "/(app)/(tabs)/plan",
    });
    assert.deepEqual(resolveMobileNotificationDestination("/tr/koc/sohbet?thread=1", true), {
      pathname: "/(app)/(tabs)/coach",
    });
    assert.deepEqual(
      resolveMobileNotificationDestination("/bilgi/kpss-lisans-p3-net-hesaplama", true),
      {
        pathname: "/(app)/knowledge",
        params: { slug: "kpss-lisans-p3-net-hesaplama" },
      },
    );
    assert.equal(resolveMobileNotificationDestination("/community/member/test?tab=achievements", true), null);
    assert.deepEqual(resolveMobileNotificationDestination("/community/member/test?tab=achievements", false), {
      pathname: "/(app)/community-member",
      params: { username: "test" },
    });
    assert.deepEqual(resolveMobileNotificationDestination("/community/question/q-123", false), {
      pathname: "/(app)/community-thread",
      params: { id: "q-123", kind: "question" },
    });
    assert.deepEqual(resolveMobileNotificationDestination("/topluluk", false), {
      pathname: "/(app)/(tabs)/community",
    });
    assert.deepEqual(resolveMobileNotificationDestination("/tr/kocum", false), {
      pathname: "/(app)/my-coach",
    });
    assert.deepEqual(
      resolveMobileNotificationDestination("/my-coach/weekly-reports/rep-42", false),
      { pathname: "/(app)/my-coach-weekly-report", params: { reportId: "rep-42" } },
    );
    assert.deepEqual(resolveMobileNotificationDestination("/students/stu-99", false), {
      pathname: "/(app)/coach-student",
      params: { studentId: "stu-99" },
    });
    assert.deepEqual(resolveMobileNotificationDestination("/students/profile", false), {
      pathname: "/(app)/(tabs)/students/profile",
    });
    assert.equal(resolveMobileNotificationDestination("https://evil.example.com", true), null);
  });
});
