import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const COMPONENT_DIR = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(COMPONENT_DIR, "../../../../../..");

function readComponent(fileName: string) {
  return readFileSync(resolve(COMPONENT_DIR, fileName), "utf8");
}

function readMessages(locale: "tr" | "en") {
  const contents = readFileSync(resolve(WEB_ROOT, "messages", `${locale}.json`), "utf8");
  return JSON.parse(contents) as { community: Record<string, string> };
}

describe("community hub editorial redesign contract", () => {
  it("uses the supplied feed visual with mirrored localized alternative text", () => {
    const hub = readComponent("hub-shell.tsx");

    expect(hub).toContain('src="/img/feed.png"');
    expect(hub).toContain('t("hub_featured_image_alt")');
    expect(readMessages("tr").community.hub_featured_image_alt).toBeTruthy();
    expect(readMessages("en").community.hub_featured_image_alt).toBeTruthy();
  });

  it("keeps room rows compact without message counters", () => {
    expect(readComponent("zone-sidebar.tsx")).not.toContain('t("messages_count"');
  });

  it("keeps navigation available without rendering a second error when rooms fail", () => {
    const sidebar = readComponent("zone-sidebar.tsx");

    expect(sidebar).not.toContain('t("error")');
    expect(sidebar).not.toContain("if (error)");
    expect(sidebar).toContain(".catch(() => setZones([]))");
  });

  it("keeps personal streak and XP out of the effort board", () => {
    const hub = readComponent("hub-shell.tsx");

    expect(hub).not.toContain("effort.streak");
    expect(hub).not.toContain("effort.xp");
  });

  it("uses Mentor as the dedicated workspace wordmark", () => {
    expect(readMessages("tr").community.sidebar_title).toBe("Mentor");
    expect(readMessages("en").community.sidebar_title).toBe("Mentor");
  });

  it("uses a pastel empty state and an icon-only room join action", () => {
    const hub = readComponent("hub-shell.tsx");

    expect(hub).toContain(
      "rounded-[10px] bg-[var(--community-blue-soft)]",
    );
    expect(hub).toContain('aria-label={joiningZone === zone.id ? t("joining") : t("join")}');
    expect(hub).toContain('className="group-hover:stroke-[3] group-focus-visible:stroke-[3]"');
  });
});
