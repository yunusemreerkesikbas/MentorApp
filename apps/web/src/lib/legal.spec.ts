import { describe, expect, it } from "vitest";

import { LEGAL_DOCUMENTS, LEGAL_SLUGS, PLACEHOLDER_MARKER } from "./legal";

describe("legal document registry", () => {
  it("publishes all six complete documents in both locales", () => {
    expect(LEGAL_SLUGS).toHaveLength(6);
    expect(new Set(LEGAL_SLUGS).size).toBe(6);

    for (const slug of LEGAL_SLUGS) {
      const document = LEGAL_DOCUMENTS[slug];
      expect(document.status).toBe("FINAL");
      expect(document.tr.body).not.toContain(PLACEHOLDER_MARKER);
      expect(document.en.body).not.toContain(PLACEHOLDER_MARKER);
      expect(document.tr.body.length).toBeGreaterThan(300);
      expect(document.en.body.length).toBeGreaterThan(300);
    }
  });

  it("identifies the data controller and application channel in the binding notice", () => {
    const notice = LEGAL_DOCUMENTS["kvkk-aydinlatma"].tr.body;

    expect(notice).toContain("Yunus Emre Erkesikbaş");
    expect(notice).toContain("Mustafa Sabri Küçükaşçı Caddesi No: 28/B");
    expect(notice).toContain("info@mentor.com");
  });
});
