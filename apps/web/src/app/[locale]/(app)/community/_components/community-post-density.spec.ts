import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const COMPONENT_DIR = dirname(fileURLToPath(import.meta.url));

describe("shared community post density", () => {
  it("uses compact vertical rhythm while preserving full action targets", () => {
    const threadItem = readFileSync(
      resolve(COMPONENT_DIR, "../[slug]/_components/thread-item.tsx"),
      "utf8",
    );

    expect(threadItem).toContain("bg-white px-4 py-3");
    expect(threadItem).toContain("sm:px-5");
    expect(threadItem).not.toContain("sm:p-5");
    expect(threadItem).toContain('displayedTitle ? "text-[#69707c]"');
    expect(threadItem).toContain("<AttachmentGallery attachments={thread.attachments} />");
    expect(threadItem).toContain('<div className="mt-1 flex w-full');
    expect(threadItem).toContain("min-h-11 min-w-11");
    expect(threadItem).toContain("text-[15px] leading-[1.55]");
  });

  it("shares typography and outer density with the discovery feed renderer", () => {
    const discoveryCard = readFileSync(
      resolve(COMPONENT_DIR, "../feed/_components/discovery-feed-card.tsx"),
      "utf8",
    );

    expect(discoveryCard).toContain("bg-white px-4 py-3");
    expect(discoveryCard).not.toContain("sm:p-5");
    expect(discoveryCard).toContain("text-[15px] leading-[1.55]");
  });

  it("uses thirteen pixel reaction totals in the shared action row", () => {
    const reactionBar = readFileSync(resolve(COMPONENT_DIR, "reaction-bar.tsx"), "utf8");

    expect(reactionBar).toContain("px-1.5 text-[13px] tabular-nums");
  });
});
