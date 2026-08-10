import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const COMPONENT_DIR = dirname(fileURLToPath(import.meta.url));
const COMMUNITY_DIR = resolve(COMPONENT_DIR, "..");
const WEB_ROOT = resolve(COMPONENT_DIR, "../../../../../..");

function read(path: string) {
  return readFileSync(path, "utf8");
}

describe("community quick reply contract", () => {
  it("routes thread and comment replies through the existing mutation functions", () => {
    const provider = read(resolve(COMPONENT_DIR, "community-quick-reply.tsx"));

    expect(provider).toContain('target.targetType === "thread"');
    expect(provider).toContain("postComment(target.targetId");
    expect(provider).toContain("postReply(target.targetId");
  });

  it("opens quick reply from both thread and comment actions", () => {
    const thread = read(resolve(COMMUNITY_DIR, "[slug]", "_components", "thread-item.tsx"));
    const comment = read(resolve(COMPONENT_DIR, "comment-row.tsx"));

    expect(thread).toContain('targetType: "thread"');
    expect(comment).toContain('targetType: "post"');
  });

  it("uses the trends rail instead of the participants rail and mirrors new copy", () => {
    const detail = read(
      resolve(COMMUNITY_DIR, "message", "[threadId]", "_components", "message-shell.tsx"),
    );
    const tr = JSON.parse(read(resolve(WEB_ROOT, "messages", "tr.json"))) as {
      community: Record<string, string>;
    };
    const en = JSON.parse(read(resolve(WEB_ROOT, "messages", "en.json"))) as {
      community: Record<string, string>;
    };

    expect(detail).toContain("<CommunityTrendRail />");
    expect(detail).not.toContain("detail_participants");
    expect(tr.community.quick_reply_title).toBeTruthy();
    expect(en.community.quick_reply_title).toBeTruthy();
  });
});
