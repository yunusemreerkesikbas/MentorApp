import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const COMPONENT_DIR = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(COMPONENT_DIR, "../../../../../..");

const HUB_FILES = [
  "hub-shell.tsx",
  "hub-hero.tsx",
  "hub-waiting-questions.tsx",
  "hub-discussions.tsx",
  "hub-rooms.tsx",
  "hub-rail.tsx",
];

function readComponent(fileName: string) {
  return readFileSync(resolve(COMPONENT_DIR, fileName), "utf8");
}

function readMessages(locale: "tr" | "en") {
  const contents = readFileSync(resolve(WEB_ROOT, "messages", `${locale}.json`), "utf8");
  return JSON.parse(contents) as { community: Record<string, string> };
}

/** Topluluk Tur 1 (2026-10-07): the hub on the panel's language, see DESIGN.md §1 and §6.1. */
describe("community hub (Keşfet) contract", () => {
  const hub = HUB_FILES.map(readComponent).join("\n");

  it("has exactly one filled ledge and no stock artwork", () => {
    expect(hub.match(/LEDGE_FILLED}/g)).toHaveLength(1);
    expect(hub).not.toContain("/img/feed.png");
  });

  it("tells room types apart by glyph, never by a coloured well", () => {
    expect(hub).not.toMatch(/--community-(coral|green)/);
    expect(readComponent("zone-sidebar.tsx")).not.toMatch(/--community-(coral|green)|bg-\[var\(--color-success\)\]/);
  });

  it("keeps personal streak and XP out of the hub", () => {
    expect(hub).not.toContain("effort.streak");
    expect(hub).not.toContain("effort.xp");
  });

  it("keeps room rows in the sidebar compact and the navigation alive when rooms fail", () => {
    const sidebar = readComponent("zone-sidebar.tsx");
    expect(sidebar).not.toContain('t("messages_count"');
    expect(sidebar).not.toContain('t("error")');
    expect(sidebar).toContain(".catch(() => setZones([]))");
  });

  it("names the workspace once and leaves the person to the sidebar, not a header chip", () => {
    expect(readMessages("tr").community.sidebar_title).toBe("Topluluk");
    expect(readMessages("en").community.sidebar_title).toBe("Community");
    expect(readComponent("community-header.tsx")).not.toContain("community-header__profile");
    expect(readComponent("zone-sidebar.tsx")).toContain('t("profile_nav")');
  });

  it("mirrors the hub copy in Turkish and English", () => {
    const tr = readMessages("tr").community;
    const en = readMessages("en").community;
    for (const key of [
      "hub_nav",
      "hub_today_title",
      "hub_bubble",
      "hub_bubble_quiet",
      "hub_prompt",
      "hub_share",
      "hub_ask",
      "hub_focusing_now",
      "hub_join_table",
      "hub_waiting_title",
      "hub_lend_hand",
      "hub_featured_eyebrow",
      "hub_supporters_one",
      "hub_supporters_two",
      "hub_supporters_many",
      "group_mine",
      "group_others",
      "profile_nav",
      "status_waiting",
      "status_answers",
      "status_solved",
    ]) {
      expect(tr[key], key).toBeTruthy();
      expect(en[key], key).toBeTruthy();
    }
    expect(tr.hub_nav).toBe("Keşfet");
  });
});
