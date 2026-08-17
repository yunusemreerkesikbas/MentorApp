import { describe, expect, it } from "vitest";

import { resolveComposerThreadText } from "./composer-thread-text";

describe("resolveComposerThreadText", () => {
  it("stores the poll heading as the thread body and never as a CHAT title", () => {
    expect(
      resolveComposerThreadText({
        mode: "share",
        body: "Eski genel içerik",
        title: "",
        pollTitle: "  Bugün hangi konuyu çalışalım?  ",
        hasPoll: true,
      }),
    ).toEqual({ body: "Bugün hangi konuyu çalışalım?", title: undefined });
  });

  it("keeps normal posts body-only and QA questions title plus body", () => {
    expect(
      resolveComposerThreadText({
        mode: "share",
        body: "  Normal paylaşım  ",
        title: "Gizli başlık",
        pollTitle: "",
        hasPoll: false,
      }),
    ).toEqual({ body: "Normal paylaşım", title: undefined });
    expect(
      resolveComposerThreadText({
        mode: "question",
        body: "  Soru ayrıntısı  ",
        title: "  Soru başlığı  ",
        pollTitle: "",
        hasPoll: false,
      }),
    ).toEqual({ body: "Soru ayrıntısı", title: "Soru başlığı" });
  });
});
