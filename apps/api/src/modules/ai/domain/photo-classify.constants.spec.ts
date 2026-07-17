import { describe, expect, it } from "vitest";
import { PHOTO_CLASSIFY_SYSTEM } from "./photo-classify.constants";

describe("PHOTO_CLASSIFY_SYSTEM", () => {
  it("requires whitelist-only subject/topic JSON and forbids solving", () => {
    expect(PHOTO_CLASSIFY_SYSTEM).toContain("whitelist");
    expect(PHOTO_CLASSIFY_SYSTEM).toContain('"subjectSlug"');
    expect(PHOTO_CLASSIFY_SYSTEM).toContain('"topicSlug"');
    expect(PHOTO_CLASSIFY_SYSTEM).toContain("Soruyu ÇÖZME");
    expect(PHOTO_CLASSIFY_SYSTEM).toContain("açıklama yapma");
  });
});
