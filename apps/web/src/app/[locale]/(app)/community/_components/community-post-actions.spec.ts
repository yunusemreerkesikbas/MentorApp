import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const COMPONENT_DIR = dirname(fileURLToPath(import.meta.url));

describe("shared community post owner actions", () => {
  it("drives edit and delete visibility from server capabilities", () => {
    const threadItem = readFileSync(
      resolve(COMPONENT_DIR, "../[slug]/_components/thread-item.tsx"),
      "utf8",
    );
    const threadMenu = readFileSync(
      resolve(COMPONENT_DIR, "../[slug]/_components/thread-menu.tsx"),
      "utf8",
    );

    expect(threadItem).toContain("canEdit={thread.capabilities?.canEdit}");
    expect(threadItem).toContain("canDelete={thread.capabilities?.canDelete}");
    expect(threadMenu).toContain("canEdit?: boolean");
    expect(threadMenu).toContain("canDelete?: boolean");
    expect(threadMenu).toContain('{t("edit")}');
    expect(threadMenu).toContain('{t("delete")}');
  });

  it("keeps editing inside the shared post card", () => {
    const threadItem = readFileSync(
      resolve(COMPONENT_DIR, "../[slug]/_components/thread-item.tsx"),
      "utf8",
    );

    expect(threadItem).toContain("updateForumThread");
    expect(threadItem).toContain('setEditing(true)');
    expect(threadItem).toContain('t("save")');
    expect(threadItem).toContain('t("cancel")');
  });

  it("reuses the create composer body field for inline editing", () => {
    const threadItem = readFileSync(
      resolve(COMPONENT_DIR, "../[slug]/_components/thread-item.tsx"),
      "utf8",
    );
    const globalComposer = readFileSync(
      resolve(COMPONENT_DIR, "../feed/_components/global-composer.tsx"),
      "utf8",
    );
    const bodyField = readFileSync(resolve(COMPONENT_DIR, "composer-body-field.tsx"), "utf8");

    expect(threadItem).toContain("<ComposerBodyField");
    expect(globalComposer).toContain("<ComposerBodyField");
    expect(bodyField).toContain("<EmojiPickerButton");
    expect(bodyField).toContain("{value.length}/4000");
    expect(bodyField).toContain("text-[15px]");
  });
});
