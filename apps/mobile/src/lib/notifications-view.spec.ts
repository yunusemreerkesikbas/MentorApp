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
      pathname: "/(app)/(tabs)/community",
    });
    assert.equal(resolveMobileNotificationDestination("https://evil.example.com", true), null);
  });
});
