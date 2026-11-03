import { describe, expect, it } from "vitest";
import { splitArticleProvenance } from "./article-provenance";

describe("article provenance", () => {
  it("retains scope and page citations while leaving credits and related links in the body", () => {
    const result = splitArticleProvenance("Intro\n\n> Kaynak kapsamı: 2026 kuralları.\n> İstisna korunur.\n\n## Konu\nRule\n\n## Kaynak\n[ÖSYM](https://osym.gov.tr), PDF 19.\n\n## Görsel kaynağı\nCredit\n\n## İlgili yazılar\nLinks", "MARKDOWN");
    expect(result.scope).toBe("2026 kuralları.\nİstisna korunur.");
    expect(result.citation).toBe("[ÖSYM](https://osym.gov.tr), PDF 19.");
    expect(result.body).toContain("## Konu\nRule");
    expect(result.body).toContain("## Görsel kaynağı\nCredit");
    expect(result.body).toContain("## İlgili yazılar\nLinks");
    expect(result.body).not.toContain("Kaynak kapsamı");
  });
  it("keeps ordinary blockquotes and handles a source section at the end", () => {
    expect(splitArticleProvenance("> Advice\n\n## Kaynak\nCitation", "MARKDOWN")).toEqual({body:"> Advice",scope:null,citation:"Citation"});
  });
  it("does not rewrite HTML articles", () => {
    expect(splitArticleProvenance("<p>Kaynak</p>", "HTML")).toEqual({body:"<p>Kaynak</p>",scope:null,citation:null});
  });
  it("supports the bold scope label and plural sources used by earlier batches", () => {
    expect(splitArticleProvenance("> **Kaynak kapsamı:** 2026.\n\nText\n\n## Kaynaklar\nSource A\nSource B", "MARKDOWN"))
      .toEqual({body:"Text",scope:"2026.",citation:"Source A\nSource B"});
  });
});
